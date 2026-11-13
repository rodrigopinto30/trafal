"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { UploadPhase } from "@/lib/games/use-zip-upload";
import { cn } from "@/lib/utils";

type Phase = UploadPhase | "creating";
type StepLabels = { creating: string; uploading: string; confirming: string };

type Props = {
  phase: Phase;
  percent: number;
  stepText: string;
  progressLabel: string;
  steps?: StepLabels;
  warning?: string;
};

const STEP_ORDER = ["creating", "uploading", "confirming"] as const;

/**
 * Live status of a zip upload, impossible to miss: a card with what is happening now, the three steps (prepare, upload, finish)
 * marked as done, in progress or waiting when the form gives their names, a progress bar while the file travels and a warning
 * not to leave the page. It scrolls itself into view when the upload starts so the person is looking at it, not at the form they
 * just sent.
 */
export function UploadProgress({ phase, percent, stepText, progressLabel, steps, warning }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = stepText !== "";
  useEffect(() => {
    if (!visible) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [visible]);
  if (!visible) return null;

  return (
    <div ref={ref} role="status" aria-live="polite" className="grid gap-4 rounded-2xl border border-cyan/40 bg-cyan/10 p-5">
      <p className="text-base font-semibold text-text">{stepText}</p>
      {steps ? <StepList phase={phase} steps={steps} /> : null}
      {phase === "uploading" ? (
        <progress
          aria-label={progressLabel}
          value={percent}
          max={100}
          className="h-2.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-cyan [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-cyan"
        />
      ) : null}
      {warning && phase !== "done" ? <p className="text-sm text-text-2">{warning}</p> : null}
    </div>
  );
}

function StepList({ phase, steps }: { phase: Phase; steps: StepLabels }) {
  const current = phase === "done" ? STEP_ORDER.length : STEP_ORDER.findIndex((step) => step === phase);
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {STEP_ORDER.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "waiting";
        return (
          <li key={step} data-state={state} className={cn("flex items-center gap-2 text-sm", state === "waiting" ? "text-text-3" : "text-text")}>
            <span
              aria-hidden="true"
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border",
                state === "done" && "border-transparent bg-cyan text-ink",
                state === "current" && "border-cyan text-cyan",
                state === "waiting" && "border-white/25",
              )}
            >
              {state === "done" ? <CheckIcon className="size-4" strokeWidth={3} /> : null}
              {state === "current" ? <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" /> : null}
            </span>
            <span className={cn(state === "current" && "font-semibold")}>{steps[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
