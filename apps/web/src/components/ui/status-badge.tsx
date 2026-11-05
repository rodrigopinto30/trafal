import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: { badge: "border-white/35 bg-white/12", dot: "bg-white" },
  violet: { badge: "border-violet/80 bg-violet/30", dot: "bg-violet" },
  cyan: { badge: "border-cyan/70 bg-cyan/20", dot: "bg-cyan" },
  coral: { badge: "border-coral/80 bg-coral/25", dot: "bg-coral" },
} as const;

export type StatusTone = keyof typeof TONES;

type StatusBadgeProps = React.ComponentProps<"span"> & {
  tone: StatusTone;
  /** Pulses the dot to show that something is still in progress (respects reduced motion). */
  live?: boolean;
};

/**
 * Readable status label for lists and headers (draft, reviewing, ready...). Unlike Badge it uses regular text at 14 px with a
 * light foreground over a tinted background, so it keeps a strong contrast on cards; the colored dot reinforces the meaning.
 */
function StatusBadge({ tone, live = false, className, children, ...props }: StatusBadgeProps) {
  const style = TONES[tone];
  return (
    <span
      data-slot="status-badge"
      className={cn("inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm leading-none font-semibold whitespace-nowrap text-white", style.badge, className)}
      {...props}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", style.dot, live && "animate-pulse motion-reduce:animate-none")} />
      {children}
    </span>
  );
}

export { StatusBadge };
