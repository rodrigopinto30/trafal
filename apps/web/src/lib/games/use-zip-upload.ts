"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { putZip } from "@/lib/games/zip-upload";
import { confirmUploadAction, renewUploadUrlAction, reviewStatusAction } from "@/lib/games/upload-actions";

export type PendingUpload = { versionId: string; uploadUrl: string };
export type UploadPhase = "idle" | "uploading" | "confirming" | "reviewing" | "done";

const REVIEW_POLL_MS = 2_000;
const REVIEW_SLOW_AFTER_MS = 45_000;

type Options = {
  locale: string;
  uploadFailedMessage: string;
  genericErrorMessage: string;
  /** Waits for the review of the zip before finishing, instead of finishing as soon as the zip is in the review queue. */
  waitForReview?: boolean;
  onUploaded?: (upload: PendingUpload) => void;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Uploads a game zip straight to quarantine with its presigned URL and confirms it, reporting progress. If the upload is
 * cut it offers a retry with a fresh URL for the same version. With `waitForReview` it then asks every few seconds how the
 * review went: a rejected zip ends with `rejected` and the reason in `message`, and `reviewSlow` turns on when the review takes
 * longer than usual. Shared by the "upload a game" and "upload a new version" forms. `run` and `retry` resolve to true when
 * the upload was confirmed (and, when waiting for it, approved).
 */
export function useZipUpload({ locale, uploadFailedMessage, genericErrorMessage, waitForReview = false, onUploaded }: Options) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [percent, setPercent] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [reviewSlow, setReviewSlow] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const awaitReview = useCallback(
    async (versionId: string) => {
      const started = Date.now();
      while (mounted.current) {
        await wait(REVIEW_POLL_MS);
        if (!mounted.current) break;
        const review = await reviewStatusAction(versionId, locale);
        if (review.status !== "pending") return review;
        if (Date.now() - started > REVIEW_SLOW_AFTER_MS) setReviewSlow(true);
      }
      return null;
    },
    [locale],
  );

  const run = useCallback(
    async (upload: PendingUpload, file: File): Promise<boolean> => {
      setPending(upload);
      setMessage(undefined);
      setCanRetry(false);
      setRejected(false);
      setReviewSlow(false);
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
      if (waitForReview) {
        setPhase("reviewing");
        const review = await awaitReview(upload.versionId);
        if (!review) return false;
        setReviewSlow(false);
        if (review.status === "rejected") {
          setPhase("idle");
          setRejected(true);
          setMessage(review.message);
          return false;
        }
      }
      setPhase("done");
      onUploaded?.(upload);
      return true;
    },
    [locale, onUploaded, uploadFailedMessage, waitForReview, awaitReview],
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
    setRejected(false);
    setReviewSlow(false);
    setMessage(undefined);
    setPending(null);
  }, []);

  return { phase, percent, canRetry, rejected, reviewSlow, message, setMessage, pending, run, retry, reset };
}
