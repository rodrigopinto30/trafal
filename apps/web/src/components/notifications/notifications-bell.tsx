"use client";

import { BellIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { unreadBadgeText } from "@/lib/notifications/unread";
import { recentNotificationsAction, type BellEntry } from "@/lib/notifications/actions";
import { loadBrowserClient } from "@/lib/supabase/load-client";

/**
 * The bell in the bar: a button with how many notifications are unread that opens a menu with the latest ones and a link to all of
 * them. While the page is open it listens to the database (realtime respects the same row rules, so it only hears about the person's
 * own notifications): a new one adds to the number at once. Reading or dismissing refreshes the page (see the notification actions).
 * If the connection cannot be made, the number is simply what the page loaded.
 */
export function NotificationsBell({ userId, unread }: { userId: string; unread: number }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<BellEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [seen, setSeen] = useState(unread);
  const [arrived, setArrived] = useState(0);
  if (seen !== unread) {
    setSeen(unread);
    setArrived(0);
  }

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    loadBrowserClient()
      .then(async (supabase) => {
        const { data } = await supabase.auth.getSession();
        if (cancelled || !data.session) return;
        await supabase.realtime.setAuth(data.session.access_token);
        if (cancelled) return;
        const channel = supabase
          .channel(`notifications:${userId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => setArrived((count) => count + 1))
          .subscribe();
        cleanup = () => void supabase.removeChannel(channel);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [userId]);

  const count = unread + arrived;
  const badge = unreadBadgeText(count);
  const label = count > 0 ? t("notificationsUnread", { count: badge }) : t("notifications");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setFailed(false);
    recentNotificationsAction(locale)
      .then((result) => (result.ok ? setEntries(result.entries) : setFailed(true)))
      .catch(() => setFailed(true));
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors outline-none hover:bg-white/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyan data-[state=open]:bg-white/8 data-[state=open]:text-foreground"
        >
          <BellIcon aria-hidden="true" className="size-5" />
          {count > 0 ? (
            <span aria-hidden="true" className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-cyan px-1 text-[11px] leading-[18px] font-bold text-ink">
              {badge}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="max-h-[75svh] w-[min(92vw,380px)] overflow-y-auto p-0">
        <DropdownMenuLabel className="px-4 py-3 font-display text-base font-bold text-foreground">{t("notificationsMenu.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        {entries === null ? (
          <p role="status" className="px-4 py-6 text-sm text-text-2">
            {failed ? t("notificationsMenu.error") : t("notificationsMenu.loading")}
          </p>
        ) : entries.length === 0 ? (
          <p role="status" className="px-4 py-6 text-sm text-text-2">
            {t("notificationsMenu.empty")}
          </p>
        ) : (
          entries.map((entry) => (
            <DropdownMenuItem key={entry.id} asChild className="min-h-11 items-start rounded-none px-4 py-3">
              <a href={entry.href} className="grid gap-0.5">
                <span className={entry.unread ? "font-semibold text-foreground" : "text-text-2"}>
                  {entry.unread ? <span className="sr-only">{t("notificationsMenu.unread")}: </span> : null}
                  {entry.text}
                </span>
                {entry.detail ? <span className="line-clamp-2 text-sm break-words text-text-2">{entry.detail}</span> : null}
                <span className="text-xs text-text-3">{entry.when}</span>
              </a>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem asChild className="min-h-11 justify-center rounded-none px-4 py-3 font-semibold text-cyan">
          <Link href="/notifications">{t("notificationsMenu.seeAll")}</Link>
        </DropdownMenuItem>
        {failed && entries !== null ? <p role="status" className="sr-only">{t("notificationsMenu.error")}</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
