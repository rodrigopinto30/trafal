"use client";

import { Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { UploadProgress } from "@/components/games/upload-progress";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RevealedMessage } from "@/components/ui/revealed-message";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { localizePath, stripLocale } from "@/i18n/path";
import { formatBytes } from "@/lib/format";
import { createGameAction } from "@/lib/games/upload-actions";
import { createVersionAction } from "@/lib/games/version-actions";
import {
  CONTROLS_MAX,
  DESCRIPTION_MAX,
  MAX_QUESTIONS,
  MAX_ZIP_BYTES,
  TITLE_MAX,
  looksLikeZip,
} from "@/lib/games/upload-rules";
import { useZipUpload } from "@/lib/games/use-zip-upload";
import { GENRE_IDS } from "@/lib/profile/catalog";

type Phase = "idle" | "creating" | "uploading" | "confirming" | "reviewing" | "done";
type CreatedGame = { id: string; publicId: string };

const IMAGE_TYPES = "image/png,image/jpeg,image/webp";
const ZIP_TYPES = ".zip,application/zip,application/x-zip-compressed";

/**
 * "Upload a game" form with its own state, started again every time the person leaves the page: Next keeps the previous screen
 * mounted, so without this a form that was already used would come back filled with the last game.
 */
export function NewGameForm() {
  const pathname = usePathname();
  const onThisPage = stripLocale(pathname).path === "/games/new";
  const [wasOnThisPage, setWasOnThisPage] = useState(onThisPage);
  const [visits, setVisits] = useState(0);
  if (wasOnThisPage !== onThisPage) {
    setWasOnThisPage(onThisPage);
    if (!onThisPage) setVisits((count) => count + 1);
  }
  return <GameUploadForm key={visits} />;
}

/**
 * The fields and the steps of the upload. It creates the game as a draft on the server, uploads the zip straight to quarantine
 * with a presigned URL (with progress), confirms the upload and waits for the review, all in the card next to the button. Once
 * the zip passes, it takes the person to the game's page, which offers to publish it. If the zip does not pass, the reason
 * shows here and another zip can be sent as a new version of the same draft. The server validates everything again; the
 * checks here only save a round trip.
 */
function GameUploadForm() {
  const t = useTranslations("gameForm");
  const tGenres = useTranslations("genres");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const createdRef = useRef<CreatedGame | null>(null);
  const [createdGame, setCreatedGame] = useState<CreatedGame | null>(null);
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | undefined>();
  const [zipInfo, setZipInfo] = useState<string | null>(null);

  const upload = useZipUpload({
    locale,
    uploadFailedMessage: t("uploadFailed"),
    genericErrorMessage: t("errors.generic"),
    waitForReview: true,
    onUploaded: () => {
      window.scrollTo(0, 0);
      router.push(localizePath(locale, `/games/${createdRef.current?.publicId}?uploaded=1`));
    },
  });
  const phase: Phase = creating ? "creating" : upload.phase;
  const busy = phase !== "idle";
  const locked = busy || createdGame !== null;
  const zipLocked = busy || (createdGame !== null && !upload.rejected);
  const canRetry = upload.canRetry;
  const percent = upload.percent;
  const message = formMessage ?? upload.message;

  const [errorRound, setErrorRound] = useState(0);
  useEffect(() => {
    if (errorRound > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errorRound]);

  function showErrors(errors: Record<string, string>, general?: string) {
    setFieldErrors(errors);
    setFormMessage(general);
    setErrorRound((round) => round + 1);
  }

  function checkZip(file: File | undefined): string | null {
    if (!file) return t("errors.zipRequired");
    if (!looksLikeZip(file.name)) return t("errors.zipNotZip");
    if (file.size > MAX_ZIP_BYTES) return t("errors.zipTooLarge");
    if (file.size === 0) return t("errors.zipRequired");
    return null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const file = zipRef.current?.files?.[0];
    const zipError = checkZip(file);
    if (zipError || !file) {
      showErrors({ zip: zipError ?? t("errors.zipRequired") });
      return;
    }
    if (createdGame) {
      await uploadAnotherZip(createdGame, file);
      return;
    }
    const data = new FormData(event.currentTarget);
    data.delete("zip");
    data.set("zipName", file.name);
    data.set("zipSize", String(file.size));
    data.set("lang", locale);

    setFormMessage(undefined);
    setFieldErrors({});
    setCreating(true);
    const result = await createGameAction(data);
    setCreating(false);
    if (!result.ok) {
      showErrors(result.fieldErrors, result.message);
      return;
    }
    const game = { id: result.gameId, publicId: result.publicId };
    createdRef.current = game;
    setCreatedGame(game);
    await upload.run({ versionId: result.versionId, uploadUrl: result.uploadUrl }, file);
  }

  async function uploadAnotherZip(game: CreatedGame, file: File) {
    const data = new FormData();
    data.set("gameId", game.id);
    data.set("zipName", file.name);
    data.set("zipSize", String(file.size));
    data.set("lang", locale);
    setFormMessage(undefined);
    setFieldErrors({});
    setCreating(true);
    const result = await createVersionAction(data);
    setCreating(false);
    if (!result.ok) {
      showErrors(result.fieldErrors.zip ? { zip: result.fieldErrors.zip } : {}, result.message);
      return;
    }
    await upload.run({ versionId: result.versionId, uploadUrl: result.uploadUrl }, file);
  }

  async function retryUpload() {
    const file = zipRef.current?.files?.[0];
    if (file) await upload.retry(file);
  }

  const stepText =
    phase === "creating"
      ? t("steps.creating")
      : phase === "uploading"
        ? t("steps.uploading", { percent })
        : phase === "confirming"
          ? t("steps.confirming")
          : phase === "reviewing"
            ? t(upload.reviewSlow ? "steps.reviewingSlow" : "steps.reviewing")
            : phase === "done"
              ? t("steps.done")
              : "";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6">
      <fieldset disabled={locked} className="grid min-w-0 gap-6">
        <SettingsSection title={t("detailsTitle")}>
          <div className="grid gap-6">
            <Field id="title" label={t("fields.title")} error={fieldErrors.title}>
              {(control) => <Input {...control} name="title" maxLength={TITLE_MAX} required autoComplete="off" />}
            </Field>
            <Field id="shortDescription" label={t("fields.shortDescription")} hint={t("fields.shortDescriptionHint")} error={fieldErrors.shortDescription}>
              {(control) => <Input {...control} name="shortDescription" maxLength={DESCRIPTION_MAX} autoComplete="off" />}
            </Field>
            <Field id="genre" label={t("fields.genre")} error={fieldErrors.genre}>
              {(control) => (
                <NativeSelect {...control} name="genre" required defaultValue="">
                  <option value="">{t("fields.genrePlaceholder")}</option>
                  {GENRE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {tGenres(id as Parameters<typeof tGenres>[0])}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field id="tags" label={t("fields.tags")} hint={t("fields.tagsHint")} error={fieldErrors.tags}>
              {(control) => <Input {...control} name="tags" autoComplete="off" />}
            </Field>
            <Field id="controls" label={t("fields.controls")} hint={t("fields.controlsHint")} error={fieldErrors.controls}>
              {(control) => <Textarea {...control} name="controls" maxLength={CONTROLS_MAX} rows={4} />}
            </Field>
          </div>
        </SettingsSection>
      </fieldset>

      <SettingsSection title={t("filesTitle")}>
        <div className="grid gap-6">
          <Field id="zip" label={t("fields.zip")} hint={t("fields.zipHint", { limit: formatBytes(locale, MAX_ZIP_BYTES) })} error={fieldErrors.zip}>
            {(control) => (
              <Input
                {...control}
                ref={zipRef}
                name="zip"
                type="file"
                accept={ZIP_TYPES}
                className="py-2.5"
                required
                disabled={zipLocked}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setZipInfo(file ? t("selectedFile", { name: file.name, size: formatBytes(locale, file.size) }) : null);
                  setFieldErrors((current) => ({ ...current, zip: checkZip(file) ?? "" }));
                }}
              />
            )}
          </Field>
          {zipInfo ? <p className="-mt-3 text-sm text-text-2">{zipInfo}</p> : null}
          <Field id="cover" label={t("fields.cover")} hint={t("fields.coverHint")} error={fieldErrors.cover}>
            {(control) => <Input {...control} name="cover" type="file" accept={IMAGE_TYPES} className="py-2.5" disabled={locked} />}
          </Field>
          <Field id="screenshots" label={t("fields.screenshots")} hint={t("fields.screenshotsHint")} error={fieldErrors.screenshots}>
            {(control) => <Input {...control} name="screenshots" type="file" accept={IMAGE_TYPES} multiple className="py-2.5" disabled={locked} />}
          </Field>
        </div>
      </SettingsSection>

      <fieldset disabled={locked} className="grid min-w-0 gap-6">
        <SettingsSection title={t("feedbackTitle")} description={t("feedbackHint")}>
          <div className="grid gap-5">
            {Array.from({ length: MAX_QUESTIONS }, (_, index) => (
              <Field
                key={index}
                id={`question-${index + 1}`}
                label={t("fields.question", { number: index + 1 })}
                error={index === 0 ? (fieldErrors.questions ?? undefined) : undefined}
              >
                {(control) => <Input {...control} name="questions" maxLength={140} placeholder={t("fields.questionPlaceholder")} autoComplete="off" />}
              </Field>
            ))}
          </div>
        </SettingsSection>
      </fieldset>

      <div className="grid gap-3">
        {message ? <RevealedMessage>{message}</RevealedMessage> : null}
        <UploadProgress
          phase={phase}
          percent={percent}
          stepText={stepText}
          progressLabel={t("progressLabel")}
          steps={{ creating: t("stepLabels.creating"), uploading: t("stepLabels.uploading"), reviewing: t("stepLabels.reviewing") }}
          warning={t("leaveWarning")}
        >
          {phase === "reviewing" && upload.reviewSlow && createdGame ? (
            <p className="text-sm text-text-2">
              <Link href={`/games/${createdGame.publicId}`} className="font-semibold text-cyan underline underline-offset-4">
                {t("goToGame")}
              </Link>
            </p>
          ) : null}
        </UploadProgress>
        <div className="flex flex-wrap gap-3">
          {canRetry ? (
            <Button type="button" size="lg" onClick={retryUpload}>
              {t("retryUpload")}
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={zipLocked}>
              {busy ? (
                <>
                  <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {phase === "reviewing" ? t("reviewingButton") : t("submitting")}
                </>
              ) : upload.rejected ? (
                t("submitAnotherZip")
              ) : (
                t("submit")
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
