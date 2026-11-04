"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** Botón pixel «volver arriba»: aparece al bajar y respeta prefers-reduced-motion. */
export function BackToTop() {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label={t("backToTop")}
      tabIndex={visible ? 0 : -1}
      aria-hidden={visible ? undefined : true}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
      className={cn(
        "fixed right-3.5 bottom-3.5 z-40 grid size-[50px] place-items-center rounded-2xl border border-cyan/70 bg-[rgb(9_8_20/0.92)] sm:right-5.5 sm:bottom-5.5 sm:size-[58px]",
        "shadow-[0_0_18px_rgb(46_230_255/0.5),inset_0_0_14px_rgb(46_230_255/0.18)] transition-[opacity,transform] duration-300",
        "focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 8 8" shapeRendering="crispEdges" fill="var(--trafal-cyan)">
        <rect x="3" y="1" width="2" height="1" />
        <rect x="2" y="2" width="4" height="1" />
        <rect x="1" y="3" width="6" height="1" />
        <rect x="3" y="4" width="2" height="3" />
      </svg>
    </button>
  );
}
