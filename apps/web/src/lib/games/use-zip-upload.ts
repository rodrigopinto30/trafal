"use client";

import { useCallback, useState } from "react";
import { putZip } from "@/lib/games/zip-upload";
import { confirmUploadAction, renewUploadUrlAction } from "@/lib/games/upload-actions";

export type PendingUpload = { versionId: string; uploadUrl: string };
export type UploadPhase = "idle" | "uploading" | "confirming" | "done";

type Options = {
  locale: string;
  uploadFailedMessage: string;
  genericErrorMessage: string;
  onUploaded?: (upload: PendingUpload) => void;
};

/**
 * Uploads a game zip straight to quarantine with its presigned URL and confirms it, reporting progress. If the upload is
 * cut it offers a retry with a fresh URL for the same version. Shared by the "upload a game" and "upload a new version" forms. `run` and `retry` resolve to true when the upload was confirmed.
 */
export function useZipUpload({ locale, uploadFailedMessage, genericErrorMessage, onUploaded }: Options) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [percent, setPercent] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [pending, setPending] = useState<PendingUpload | null>(null);

  const run = useCallback(
    async (upload: PendingUpload, file: File): Promise<boolean> => {
      setPending(upload);
      setMessage(undefined);
      setCanRetry(false);
      setPhase("uploading");
      setPercent(0);
      try {
        await putZip(upload.uploadUrl, file, (fraction) => setPercent(Math.round(fraction * 100)));
      } catch {
        setPhase("idle");
        setCanRetry(true);
        setMessage(uploadFailedMessage);
        return false;
      }
      setPhase("confirming");
      const confirmed = await confirmUploadAction(upload.versionId, locale);
      if (!confirmed.ok) {
        setPhase("idle");
        setMessage(confirmed.message);
        return false;
      }
      setPhase("done");
      onUploaded?.(upload);
      return true;
    },
    [locale, onUploaded, uploadFailedMessage],
  );

  const retry = useCallback(
    async (file: File): Promise<boolean> => {
      if (!pending) return false;
      setMessage(undefined);
      setCanRetry(false);
      const renewed = await renewUploadUrlAction(pending.versionId, locale);
      if (!renewed.ok || !renewed.uploadUrl) {
        setCanRetry(true);
        setMessage(renewed.ok ? genericErrorMessage : renewed.message);
        return false;
      }
      return run({ ...pending, uploadUrl: renewed.uploadUrl }, file);
    },
    [pending, locale, run, genericErrorMessage],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setPercent(0);
    setCanRetry(false);
    setMessage(undefined);
    setPending(null);
  }, []);

  return { phase, percent, canRetry, message, setMessage, pending, run, retry, reset };
}
