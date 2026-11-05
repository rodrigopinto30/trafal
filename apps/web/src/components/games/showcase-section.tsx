import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShowcaseSectionProps = {
  id: string;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
};

export function ShowcaseSection({ id, title, subtitle, className, children }: ShowcaseSectionProps) {
  return (
    <section aria-labelledby={id} className={cn("mx-auto max-w-[1200px] px-5 pt-[clamp(64px,8vw,104px)]", className)}>
      <header className="mb-6 max-w-[640px]">
        <h2 id={id} className="font-display text-[clamp(26px,4vw,38px)] leading-[1.1] font-bold text-glow-violet">
          {title}
        </h2>
        {subtitle ? <p className="mt-2 text-text-2">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
