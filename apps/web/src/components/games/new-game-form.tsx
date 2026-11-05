"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { localizePath } from "@/i18n/path";
import { formatBytes } from "@/lib/format";
import { confirmUploadAction, createGameAction, renewUploadUrlAction } from "@/lib/games/upload-actions";
import {
  CONTROLS_MAX,
  DESCRIPTION_MAX,
  DISPLAY_RATIOS,
  MAX_QUESTIONS,
  MAX_ZIP_BYTES,
  TITLE_MAX,
  looksLikeZip,
} from "@/lib/games/upload-rules";
import { putZip } from "@/lib/games/zip-upload";
import { ENGINE_IDS, GENRE_IDS } from "@/lib/profile/catalog";

type Phase = "idle" | "creating" | "uploading" | "confirming" | "done";
type CreatedVersion = { versionId: string; publicId: string; uploadUrl: string };

const IMAGE_TYPES = "image/png,image/jpeg,image/webp";
const ZIP_TYPES = ".zip,application/zip,application/x-zip-compressed";

/**
 * "Upload a game" form. It creates the game as a draft on the server, then uploads the zip straight to quarantine with a
 * presigned URL (with progress) and finally confirms the upload so the version enters the review queue. The server
 * validates everything again; the checks here only save a round trip.
 */
export function NewGameForm() {
  const t = useTranslations("gameForm");
  const tGenres = useTranslations("genres");
  const tEngines = useTranslations("engines");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [created, setCreated] = useState<CreatedVersion | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [zipInfo, setZipInfo] = useState<string | null>(null);

  const busy = phase !== "idle";

  function showErrors(errors: Record<string, string>, general?: string) {
    setFieldErrors(errors);
    setMessage(general);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  function checkZip(file: File | undefined): string | null {
    if (!file) return t("errors.zipRequired");
    if (!looksLikeZip(file.name)) return t("errors.zipNotZip");
    if (file.size > MAX_ZIP_BYTES) return t("errors.zipTooLarge");
    if (file.size === 0) return t("errors.zipRequired");
    return null;
  }

  async function uploadAndConfirm(created: CreatedVersion, file: File) {
    setPhase("uploading");
    setPercent(0);
    try {
      await putZip(created.uploadUrl, file, (fraction) => setPercent(Math.round(fraction * 100)));
    } catch {
      setPhase("idle");
      setCanRetry(true);
      setMessage(t("uploadFailed"));
      return;
    }
    setPhase("confirming");
    const confirmed = await confirmUploadAction(created.versionId, locale);
    if (!confirmed.ok) {
      setPhase("idle");
      setMessage(confirmed.message);
      return;
    }
    setPhase("done");
    router.push(localizePath(locale, `/games/${created.publicId}/manage`));
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
    const data = new FormData(event.currentTarget);
    data.delete("zip");
    data.set("zipName", file.name);
    data.set("zipSize", String(file.size));
    data.set("lang", locale);

    setMessage(undefined);
    setFieldErrors({});
    setCanRetry(false);
    setPhase("creating");
    const result = await createGameAction(data);
    if (!result.ok) {
      setPhase("idle");
      showErrors(result.fieldErrors, result.message);
      return;
    }
    const version = { versionId: result.versionId, publicId: result.publicId, uploadUrl: result.uploadUrl };
    setCreated(version);
    await uploadAndConfirm(version, file);
  }

  async function retryUpload() {
    const file = zipRef.current?.files?.[0];
    if (!created || !file) return;
    setMessage(undefined);
    setCanRetry(false);
    const renewed = await renewUploadUrlAction(created.versionId, locale);
    if (!renewed.ok || !renewed.uploadUrl) {
      setCanRetry(true);
      setMessage(renewed.ok ? t("errors.generic") : renewed.message);
      return;
    }
    const version = { ...created, uploadUrl: renewed.uploadUrl };
    setCreated(version);
    await uploadAndConfirm(version, file);
  }

  const stepText =
    phase === "creating"
      ? t("steps.creating")
      : phase === "uploading"
        ? t("steps.uploading", { percent })
        : phase === "confirming"
          ? t("steps.confirming")
          : phase === "done"
            ? t("steps.done")
            : "";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6">
      {message ? <FormMessage>{message}</FormMessage> : null}

      <fieldset disabled={busy || created !== null} className="grid min-w-0 gap-6">
        <SettingsSection title={t("detailsTitle")}>
          <div className="grid gap-6">
            <Field id="title" label={t("fields.title")} error={fieldErrors.title}>
              {(control) => <Input {...control} name="title" maxLength={TITLE_MAX} required autoComplete="off" />}
            </Field>
            <Field id="shortDescription" label={t("fields.shortDescription")} hint={t("fields.shortDescriptionHint")} error={fieldErrors.shortDescription}>
              {(control) => <Input {...control} name="shortDescription" maxLength={DESCRIPTION_MAX} autoComplete="off" />}
            </Field>
            <div className="grid gap-6 md:grid-cols-2 md:gap-x-8">
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
              <Field id="engine" label={t("fields.engine")} error={fieldErrors.engine}>
                {(control) => (
                  <NativeSelect {...control} name="engine" required defaultValue="">
                    <option value="">{t("fields.enginePlaceholder")}</option>
                    {ENGINE_IDS.map((id) => (
                      <option key={id} value={id}>
                        {tEngines(id as Parameters<typeof tEngines>[0])}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            </div>
            <Field id="tags" label={t("fields.tags")} hint={t("fields.tagsHint")} error={fieldErrors.tags}>
              {(control) => <Input {...control} name="tags" autoComplete="off" />}
            </Field>
            <Field id="controls" label={t("fields.controls")} hint={t("fields.controlsHint")} error={fieldErrors.controls}>
              {(control) => <Textarea {...control} name="controls" maxLength={CONTROLS_MAX} rows={4} />}
            </Field>
            <Field id="displayRatio" label={t("fields.displayRatio")} error={fieldErrors.displayRatio}>
              {(control) => (
                <NativeSelect {...control} name="displayRatio" defaultValue="16:9">
                  {DISPLAY_RATIOS.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {t(`ratios.${ratio}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <Checkbox id="worksOnMobile" name="worksOnMobile" />
                <Label htmlFor="worksOnMobile" className="font-normal text-text-2">
                  {t("fields.worksOnMobile")}
                </Label>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-3">
                  <Checkbox id="isFirstGame" name="isFirstGame" aria-invalid={fieldErrors.isFirstGame ? true : undefined} />
                  <Label htmlFor="isFirstGame" className="font-normal text-text-2">
                    {t("fields.isFirstGame")}
                  </Label>
                </div>
                {fieldErrors.isFirstGame ? (
                  <p role="alert" className="text-sm font-medium text-[#ff8fa5]">
                    {fieldErrors.isFirstGame}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </SettingsSection>

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
              {(control) => <Input {...control} name="cover" type="file" accept={IMAGE_TYPES} className="py-2.5" />}
            </Field>
            <Field id="screenshots" label={t("fields.screenshots")} hint={t("fields.screenshotsHint")} error={fieldErrors.screenshots}>
              {(control) => <Input {...control} name="screenshots" type="file" accept={IMAGE_TYPES} multiple className="py-2.5" />}
            </Field>
          </div>
        </SettingsSection>

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
        {stepText ? (
          <div role="status" aria-live="polite" className="grid gap-2">
            <p className="text-sm font-semibold text-text-2">{stepText}</p>
            {phase === "uploading" ? (
              <progress aria-label={t("progressLabel")} value={percent} max={100} className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-cyan [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-cyan" />
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {canRetry ? (
            <Button type="button" size="lg" onClick={retryUpload}>
              {t("retryUpload")}
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={busy || created !== null}>
              {t("submit")}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
