"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { UploadPhase } from "@/lib/games/use-zip-upload";
import { cn } from "@/lib/utils";

type Phase = UploadPhase | "creating";
type StepId = "creating" | "uploading" | "confirming" | "reviewing";
type StepLabels = Partial<Record<StepId, string>>;

type Props = {
  phase: Phase;
  percent: number;
  stepText: string;
  progressLabel: string;
  steps?: StepLabels;
  warning?: string;
  children?: ReactNode;
};

const STEP_ORDER: readonly StepId[] = ["creating", "uploading", "confirming", "reviewing"];

/**
 * Live status of a zip upload, impossible to miss: a card with what is happening now, the steps (prepare, upload, finish or
 * review) marked as done, in progress or waiting when the form gives their names, a progress bar while the file travels and a
 * warning not to leave the page while the file is still on its way. It scrolls itself into view when the upload starts so the
 * person is looking at it, not at the form they just sent. `children` adds something under the steps (a way out when a review
 * takes long).
 */
export function UploadProgress({ phase, percent, stepText, progressLabel, steps, warning, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = stepText !== "";
  useEffect(() => {
    if (!visible) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [visible]);
  if (!visible) return null;

  const fileOnItsWay = phase === "creating" || phase === "uploading" || phase === "confirming";
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
      {warning && fileOnItsWay ? <p className="text-sm text-text-2">{warning}</p> : null}
      {children}
    </div>
  );
}

/** The named steps in order. A phase without a step of its own (finishing, when the form does not name it) shows as part of the step before it. */
function StepList({ phase, steps }: { phase: Phase; steps: StepLabels }) {
  const shown = STEP_ORDER.filter((step) => steps[step]);
  const position = phase === "done" ? STEP_ORDER.length : STEP_ORDER.indexOf(phase as StepId);
  const current = phase === "done" ? shown.length : shown.filter((step) => STEP_ORDER.indexOf(step) <= position).length - 1;
  return (
    <ol className={cn("grid gap-2", shown.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      {shown.map((step, index) => {
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
