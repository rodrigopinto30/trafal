import type { ReactNode } from "react";

/** Marco común de las pantallas de acceso: tarjeta centrada con borde neón. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-[480px] px-5 pt-[clamp(28px,6vw,64px)]">
      <div className="rounded-[28px] bg-nav-border p-px shadow-[0_0_30px_rgb(139_92_255/0.3),0_0_70px_rgb(46_230_255/0.1)]">
        <div className="grid gap-6 rounded-[27px] bg-panel p-6 sm:p-8">
          <header>
            <h1 className="font-display text-[clamp(28px,5vw,34px)] leading-tight font-bold text-glow-violet">{title}</h1>
            {subtitle ? <p className="mt-2 text-text-2">{subtitle}</p> : null}
          </header>
          {children}
        </div>
      </div>
    </section>
  );
}

/** Separador «─── o ───». */
export function OrDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-text-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-white/10" />
      <span aria-hidden="true">{label}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
