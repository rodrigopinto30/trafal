import { cn } from "@/lib/utils";

/** Monograma pixel «T» (degradé violeta → cian con brillo). Es un SVG, no texto: no interfiere con el nombre accesible. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-[38px] place-items-center rounded-[10px] bg-brand-diag shadow-[0_0_16px_rgb(139_92_255/0.7)]",
        className,
      )}
    >
      <svg viewBox="0 0 10 10" shapeRendering="crispEdges" fill="var(--trafal-bg)" className="size-[55%]">
        <rect x="0" y="1" width="10" height="2" />
        <rect x="4" y="3" width="2" height="6" />
      </svg>
    </span>
  );
}

/** Logotipo: monograma + «trafal.» en Pixelify Sans. El texto se oculta en pantallas muy angostas. */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWordmark ? (
        <span className="hidden font-pixel text-[21px] font-bold text-foreground text-glow-cyan min-[420px]:inline">
          trafal<span className="text-cyan">.</span>
        </span>
      ) : null}
    </span>
  );
}
