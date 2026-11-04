"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "@/i18n/client";
import { usePathname } from "next/navigation";
import { MobileNavLinks } from "./nav-links";

/**
 * Botón hamburguesa + panel del menú móvil. Se cierra con Escape, al tocar un link y al navegar.
 * `accountSlot` es un Server Component (login/crear cuenta o enlaces de la persona) que llega ya resuelto.
 */
export function MobileMenu({ accountSlot }: { accountSlot: ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  // Guardamos EN QUÉ RUTA se abrió: al navegar, la ruta cambia y el menú queda cerrado solo (sin efectos).
  // Con Cache Components las pantallas anteriores quedan montadas (ocultas), por eso no alcanza con desmontar.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean | ((current: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(open) : value;
    setOpenAt(next ? pathname : null);
  };
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAt(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? t("closeMenu") : t("openMenu")}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan/50 bg-cyan/8 shadow-glow-cyan transition-colors outline-none hover:bg-cyan/15 focus-visible:ring-2 focus-visible:ring-cyan md:hidden"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 10 10" shapeRendering="crispEdges" fill="var(--trafal-cyan)">
          {open ? (
            <>
              <rect x="2" y="2" width="1" height="1" />
              <rect x="3" y="3" width="1" height="1" />
              <rect x="4" y="4" width="2" height="2" />
              <rect x="6" y="6" width="1" height="1" />
              <rect x="7" y="7" width="1" height="1" />
              <rect x="7" y="2" width="1" height="1" />
              <rect x="6" y="3" width="1" height="1" />
              <rect x="3" y="6" width="1" height="1" />
              <rect x="2" y="7" width="1" height="1" />
            </>
          ) : (
            <>
              <rect x="1" y="2" width="8" height="1" />
              <rect x="1" y="4.5" width="8" height="1" />
              <rect x="1" y="7" width="8" height="1" />
            </>
          )}
        </svg>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-3 top-[calc(100%+8px)] max-h-[calc(100dvh-6.5rem)] overflow-y-auto rounded-[18px] border border-cyan/40 bg-[#090814] p-2.5 shadow-[0_0_24px_rgb(46_230_255/0.2)] md:hidden"
      >
        <MobileNavLinks onNavigate={() => setOpen(false)} />
        <div className="mt-2 border-t border-white/8 pt-2" onClick={(event) => {
          // Cualquier link dentro de la cuenta (perfil, login...) cierra el menú.
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}>
          {accountSlot}
        </div>
      </div>
    </>
  );
}
