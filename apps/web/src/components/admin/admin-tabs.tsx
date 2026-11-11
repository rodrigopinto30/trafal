"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { stripLocale } from "@/i18n/path";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "reports", href: "/admin" },
  { key: "claims", href: "/admin/claims" },
  { key: "appeals", href: "/admin/appeals" },
  { key: "accounts", href: "/admin/accounts" },
  { key: "log", href: "/admin/log" },
  { key: "featured", href: "/admin/featured" },
] as const;

/** Sections of the administration, as links; the current one is marked. `openReports`, `openClaims` and `openAppeals` are how many wait for someone. */
export function AdminTabs({ openReports, openClaims, openAppeals }: { openReports: number; openClaims: number; openAppeals: number }) {
  const t = useTranslations("admin");
  const { path } = stripLocale(usePathname());
  return (
    <nav aria-label={t("navLabel")}>
      <ul className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-white/8 bg-[rgb(20_18_38/0.8)] p-1">
        {TABS.map((tab) => {
          const active = tab.href === "/admin" ? path === "/admin" : path.startsWith(tab.href);
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan",
                  active ? "bg-white/10 text-foreground" : "text-text-2 hover:text-foreground",
                )}
              >
                {t(`tabs.${tab.key}`)}
                {tab.key === "reports" && openReports > 0 ? <span className="rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-ink">{openReports}</span> : null}
                {tab.key === "claims" && openClaims > 0 ? <span className="rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-ink">{openClaims}</span> : null}
                {tab.key === "appeals" && openAppeals > 0 ? <span className="rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-ink">{openAppeals}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
