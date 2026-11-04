"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { stripLocale } from "@/i18n/path";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-config";

/**
 * ¿Esta sección es la actual? Se compara SIN el prefijo de idioma: el proxy reescribe «/explore» → «/es/explore»,
 * así que el servidor y el navegador pueden ver rutas distintas; al normalizarlas con stripLocale coinciden
 * y no hay desajuste de hidratación.
 */
function isActive(href: string, pathname: string): boolean {
  const { path } = stripLocale(pathname);
  return path === href || path.startsWith(`${href}/`);
}

/** Línea neón fina bajo la sección activa. */
function ActiveMark({ vertical = false, active }: { vertical?: boolean; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute rounded-sm bg-linear-to-r from-cyan to-violet shadow-[0_0_8px_var(--trafal-cyan),0_0_16px_rgb(46_230_255/0.5)] transition-[opacity,transform] duration-300",
        vertical ? "top-3.5 left-1 h-[22px] w-[3px] bg-linear-to-b" : "right-3 bottom-1.5 left-3 h-0.5",
        active ? "scale-100 opacity-100" : vertical ? "scale-y-0 opacity-0" : "scale-x-0 opacity-0",
      )}
    />
  );
}

/** Links de la barra en escritorio. */
export function NavLinks({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className={cn("flex items-center gap-1.5", className)}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-11 items-center px-3 text-base font-semibold transition-[color,text-shadow] duration-200",
              "hover:text-white hover:text-glow-cyan",
              active ? "text-white text-glow-cyan" : "text-text-2",
            )}
          >
            {t(item.key)}
            <ActiveMark active={active} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Links del menú móvil (más grandes). `onNavigate` cierra el menú. */
export function MobileNavLinks({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("mobileLabel")} className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-[50px] items-center rounded-xl px-[18px] text-lg font-semibold transition-colors",
              active ? "bg-white/5 text-white" : "text-text-2 hover:bg-white/5 hover:text-white",
            )}
          >
            <ActiveMark vertical active={active} />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
