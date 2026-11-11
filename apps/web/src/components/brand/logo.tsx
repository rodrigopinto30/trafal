import { cn } from "@/lib/utils";

/**
 * Ícono de Trafal: un gamepad en pixel art sobre el degradé de la marca (el mismo dibujo que la pestaña del navegador, `app/icon.svg`).
 * Es un SVG decorativo, no texto: no interfiere con el nombre accesible.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-[38px] place-items-center rounded-[10px] bg-brand-diag shadow-[0_0_16px_rgb(139_92_255/0.7)]",
        className,
      )}
    >
      <svg viewBox="1 3 14 10" shapeRendering="crispEdges" className="w-[78%]">
        <g fill="var(--trafal-bg)">
          <rect x="3" y="4" width="10" height="1" />
          <rect x="2" y="5" width="12" height="1" />
          <rect x="1" y="6" width="14" height="4" />
          <rect x="2" y="10" width="4" height="1" />
          <rect x="10" y="10" width="4" height="1" />
          <rect x="2" y="11" width="3" height="1" />
          <rect x="11" y="11" width="3" height="1" />
        </g>
        <g fill="var(--trafal-text)">
          <rect x="4" y="6" width="1" height="1" />
          <rect x="3" y="7" width="3" height="1" />
          <rect x="4" y="8" width="1" height="1" />
          <rect x="7" y="8" width="2" height="1" />
          <rect x="12" y="6" width="1" height="1" />
          <rect x="12" y="8" width="1" height="1" />
        </g>
        <rect x="11" y="7" width="1" height="1" fill="var(--trafal-lime)" />
        <rect x="10" y="6" width="1" height="1" fill="var(--trafal-cyan)" />
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
