"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { UploadProgress } from "@/components/games/upload-progress";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RevealedMessage } from "@/components/ui/revealed-message";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useTranslations } from "@/i18n/client";
import { formatBytes } from "@/lib/format";
import { MAX_ZIP_BYTES, looksLikeZip } from "@/lib/games/upload-rules";
import { useZipUpload } from "@/lib/games/use-zip-upload";
import { createVersionAction } from "@/lib/games/version-actions";
import { VERSION_CHANGELOG_MAX, VERSION_LABEL_MAX } from "@/lib/validation/game-rules";

const ZIP_TYPES = ".zip,application/zip,application/x-zip-compressed";

/**
 * Form to upload a new version of a game: an optional name, an optional changelog and the zip. The version is registered on
 * the server, the zip goes straight to quarantine with a presigned URL (with progress and retry) and, once confirmed, the
 * form clears and the page refreshes to show the version in the review queue.
 */
export function NewVersionForm({ gameId }: { gameId: string }) {
  const t = useTranslations("gameVersions");
  const tForm = useTranslations("gameForm");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  const upload = useZipUpload({ locale, uploadFailedMessage: tForm("uploadFailed"), genericErrorMessage: t("errors.generic") });
  const phase = creating ? "creating" : upload.phase;
  const busy = phase !== "idle";
  const message = formMessage ?? upload.message;

  function checkZip(file: File | undefined): string | null {
    if (!file || file.size === 0) return t("errors.zipRequired");
    if (!looksLikeZip(file.name)) return t("errors.zipNotZip");
    if (file.size > MAX_ZIP_BYTES) return t("errors.zipTooLarge");
    return null;
  }

  const [errorRound, setErrorRound] = useState(0);
  useEffect(() => {
    if (errorRound > 0) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errorRound]);

  function showErrors(errors: Record<string, string>, general?: string) {
    setFieldErrors(errors);
    setFormMessage(general);
    setErrorRound((round) => round + 1);
  }

  function finish() {
    formRef.current?.reset();
    upload.reset();
    setNotice(t("uploaded"));
    router.refresh();
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
    data.set("gameId", gameId);
    data.set("zipName", file.name);
    data.set("zipSize", String(file.size));
    data.set("lang", locale);

    setNotice(null);
    setFormMessage(undefined);
    setFieldErrors({});
    setCreating(true);
    const result = await createVersionAction(data);
    setCreating(false);
    if (!result.ok) {
      showErrors(result.fieldErrors, result.message);
      return;
    }
    if (await upload.run({ versionId: result.versionId, uploadUrl: result.uploadUrl }, file)) finish();
  }

  async function retry() {
    const file = zipRef.current?.files?.[0];
    if (file && (await upload.retry(file))) finish();
  }

  const stepText =
    phase === "creating"
      ? tForm("steps.creating")
      : phase === "uploading"
        ? tForm("steps.uploading", { percent: upload.percent })
        : phase === "confirming"
          ? tForm("steps.confirming")
          : "";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-5">
      <fieldset disabled={busy || upload.canRetry} className="grid min-w-0 gap-5">
        <Field id="version-label" label={t("label")} hint={t("labelHint")} error={fieldErrors.label}>
          {(control) => <Input {...control} name="label" maxLength={VERSION_LABEL_MAX} autoComplete="off" />}
        </Field>
        <Field id="version-changelog" label={t("changelog")} hint={t("changelogHint")} error={fieldErrors.changelog}>
          {(control) => <Textarea {...control} name="changelog" maxLength={VERSION_CHANGELOG_MAX} rows={3} />}
        </Field>
        <Field id="version-zip" label={tForm("fields.zip")} hint={tForm("fields.zipHint", { limit: formatBytes(locale, MAX_ZIP_BYTES) })} error={fieldErrors.zip}>
          {(control) => <Input {...control} ref={zipRef} name="zip" type="file" accept={ZIP_TYPES} required className="py-2.5" />}
        </Field>
      </fieldset>
      {message ? <RevealedMessage>{message}</RevealedMessage> : null}
      {notice ? <RevealedMessage tone="info">{notice}</RevealedMessage> : null}
      <UploadProgress
        phase={phase}
        percent={upload.percent}
        stepText={stepText}
        progressLabel={tForm("progressLabel")}
        steps={{ creating: tForm("stepLabels.creating"), uploading: tForm("stepLabels.uploading"), confirming: tForm("stepLabels.confirming") }}
        warning={tForm("leaveWarning")}
      />
      <div className="flex flex-wrap gap-3">
        {upload.canRetry ? (
          <Button type="button" size="lg" onClick={retry}>
            {tForm("retryUpload")}
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
