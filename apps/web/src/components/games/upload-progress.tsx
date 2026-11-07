import type { UploadPhase } from "@/lib/games/use-zip-upload";

type Props = {
  phase: UploadPhase | "creating";
  percent: number;
  stepText: string;
  progressLabel: string;
};

/** Live status of a zip upload: what step it is on and, while the file travels, a progress bar. */
export function UploadProgress({ phase, percent, stepText, progressLabel }: Props) {
  if (!stepText) return null;
  return (
    <div role="status" aria-live="polite" className="grid gap-2">
      <p className="text-sm font-semibold text-text-2">{stepText}</p>
      {phase === "uploading" ? (
        <progress
          aria-label={progressLabel}
          value={percent}
          max={100}
          className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-cyan [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-cyan"
        />
      ) : null}
    </div>
  );
}
