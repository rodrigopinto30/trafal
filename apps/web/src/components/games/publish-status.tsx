import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PublishStage = "uploading" | "processing" | "failed";
type StepState = "done" | "current" | "waiting" | "failed";

export type PublishStatusLabels = {
  title: string;
  text: string;
  steps: { uploaded: string; review: string; publish: string };
  stepState: Record<StepState, string>;
  publishLabel: string;
  publishHint: string;
};

const STEP_STATES: Record<PublishStage, [StepState, StepState, StepState]> = {
  uploading: ["current", "waiting", "waiting"],
  processing: ["done", "current", "waiting"],
  failed: ["done", "failed", "waiting"],
};

/**
 * What the owner sees while a draft cannot be published yet: why the publish button is not there (the file is still uploading,
 * being reviewed, or did not pass), a three-step progress (uploaded, review, publish) and the button itself, disabled, with the
 * reason underneath. Without it the page looks stuck, because the real button only appears once a version is ready.
 */
export function PublishStatus({ stage, labels }: { stage: PublishStage; labels: PublishStatusLabels }) {
  const states = STEP_STATES[stage];
  const stepNames = [labels.steps.uploaded, labels.steps.review, labels.steps.publish];
  const failed = stage === "failed";
  return (
    <section
      aria-labelledby="publish-status-title"
      className={cn("grid gap-4 rounded-2xl border p-5", failed ? "border-coral/40 bg-coral/10" : "border-cyan/40 bg-cyan/10")}
    >
      <div className="grid gap-1">
        <h2 id="publish-status-title" className="font-display text-lg font-bold">
          {labels.title}
        </h2>
        <p className="text-sm text-text-2">{labels.text}</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3">
        {states.map((state, index) => (
          <li key={stepNames[index]} data-state={state} className={cn("flex items-center gap-2 text-sm", state === "waiting" ? "text-text-3" : "text-text")}>
            <span
              aria-hidden="true"
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border",
                state === "done" && "border-transparent bg-cyan text-ink",
                state === "current" && "border-cyan text-cyan",
                state === "failed" && "border-transparent bg-coral text-ink",
                state === "waiting" && "border-white/25",
              )}
            >
              {state === "done" ? <CheckIcon className="size-4" strokeWidth={3} /> : null}
              {state === "current" ? <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" /> : null}
              {state === "failed" ? <XIcon className="size-4" strokeWidth={3} /> : null}
            </span>
            <span className={cn(state === "current" && "font-semibold")}>
              {stepNames[index]}
              <span className="sr-only"> ({labels.stepState[state]})</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="grid gap-2">
        <div>
          <Button type="button" size="lg" disabled aria-describedby="publish-status-hint">
            {labels.publishLabel}
          </Button>
        </div>
        <p id="publish-status-hint" className="text-sm text-text-2">
          {labels.publishHint}
        </p>
      </div>
    </section>
  );
}
