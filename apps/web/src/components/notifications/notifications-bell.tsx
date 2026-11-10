"use client";

import { BellIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { loadBrowserClient } from "@/lib/supabase/load-client";

const MAX_SHOWN = 99;

/**
 * The bell in the bar: a link to the notifications with how many are unread. While the page is open it listens to the database
 * (realtime respects the same row rules, so it only hears about the person's own notifications): a new one adds to the number
 * at once. Reading or dismissing refreshes the page (see the notification actions). If the connection cannot be made, the number is
 * simply what the page loaded.
 */
export function NotificationsBell({ userId, unread }: { userId: string; unread: number }) {
  const t = useTranslations("nav");
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
  const label = count > 0 ? t("notificationsUnread", { count }) : t("notifications");

  return (
    <Link
      href="/notifications"
      aria-label={label}
      className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors outline-none hover:bg-white/8 hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyan"
    >
      <BellIcon aria-hidden="true" className="size-5" />
      {count > 0 ? (
        <span aria-hidden="true" className="absolute top-1 right-1 grid min-w-[18px] place-items-center rounded-full bg-cyan px-1 text-[11px] leading-[18px] font-bold text-ink">
          {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
        </span>
      ) : null}
    </Link>
  );
}
