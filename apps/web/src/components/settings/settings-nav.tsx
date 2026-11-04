"use client";

import { SlidersHorizontalIcon, UserRoundIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { stripLocale } from "@/i18n/path";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings/profile", key: "profile", Icon: UserRoundIcon },
  { href: "/settings/preferences", key: "preferences", Icon: SlidersHorizontalIcon },
] as const;

/**
 * Secciones de la configuración, en pestañas en fila (las mismas píldoras que «Juegos | Avances» del perfil): así las
 * tarjetas de abajo ocupan TODO el ancho de la página, igual que en el resto del sitio.
 * Lee la ruta para marcar la sección actual, así que va dentro de un <Suspense> (regla de Cache Components).
 */
export function SettingsNav() {
  const t = useTranslations("settings");
  const current = stripLocale(usePathname()).path;

  return (
    <nav aria-label={t("navLabel")}>
      <ul className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-white/8 bg-[rgb(20_18_38/0.8)] p-1">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = current === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-[background-color,color]",
                  active ? "bg-foreground text-ink" : "text-text-2 hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {t(`nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
