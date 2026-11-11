import { Suspense } from "react";
import { ExtraMessages } from "@/components/i18n/extra-messages";
import { MarkAllReadButton, NotificationActions } from "@/components/notifications/notification-actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { formatRelativeTime } from "@/lib/format";
import { notificationHref } from "@/lib/notifications/href";
import { listNotifications, type NotificationItem } from "@/lib/notifications/queries";
import { firstParam, parseBefore } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("notifications");
  return { title: t("title"), robots: { index: false } };
}

export default function NotificationsPage({ searchParams }: PageProps<"/[lang]/notifications">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto min-h-svh max-w-[960px] rounded-3xl" aria-hidden="true" />}>
      <Notifications searchParams={searchParams} />
    </Suspense>
  );
}

const SNIPPET_MAX = 140;
const snippet = (text: string) => (Array.from(text).length > SNIPPET_MAX ? `${Array.from(text).slice(0, SNIPPET_MAX).join("")}…` : text);

async function Notifications({ searchParams }: { searchParams: PageProps<"/[lang]/notifications">["searchParams"] }) {
  await requireProfile("/notifications");
  const before = parseBefore(firstParam((await searchParams).before));
  const [t, locale, { items, nextBefore }] = await Promise.all([getTranslations("notifications"), getLocale(), listNotifications(before)]);
  const now = new Date();
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" });
  const hasUnread = items.some((item) => item.read_at === null);

  function sentence(item: NotificationItem): string {
    const who = item.actor?.display_name ?? t("someone");
    const title = item.game?.title ?? t("aGame");
    const place = item.game ? "game" : "post";
    switch (item.type) {
      case "comment":
        return t(`items.comment.${place}`, { who, title });
      case "reply":
        return t("items.reply", { who });
      case "like":
        return t(`items.like.${place}`, { who, title });
      case "follow":
        return t("items.follow", { who });
      case "helpful":
        return t("items.helpful", { who });
      case "version_ready":
        return t("items.versionReady", { version: item.version?.label ?? "", title });
      case "version_error":
        return t("items.versionError", { version: item.version?.label ?? "", title });
      case "moderation": {
        const action = item.data.action;
        if (action === "suspend") return t("items.moderation.suspend");
        if (action === "lift") return t("items.moderation.lift");
        if (action === "appeal_upheld") return t("items.moderation.appealUpheld");
        if (action === "appeal_overturned") return t("items.moderation.appealOverturned");
        const target = item.data.target_type === "game" || item.data.target_type === "post" || item.data.target_type === "comment" ? item.data.target_type : "game";
        return t(`items.moderation.${action === "restore" ? "restore" : "hide"}.${target}`);
      }
    }
  }

  function detail(item: NotificationItem): string | null {
    if (item.type === "moderation") {
      const parts = [
        item.data.until ? t("until", { date: day.format(new Date(item.data.until)) }) : null,
        item.data.reason ? t("reason", { reason: item.data.reason }) : null,
        item.data.note ? t("answer", { note: item.data.note }) : null,
      ];
      return parts.filter(Boolean).join(" · ") || null;
    }
    if ((item.type === "comment" || item.type === "reply" || item.type === "helpful") && item.comment) return `“${snippet(item.comment.body)}”`;
    return null;
  }

  return (
    <ExtraMessages namespaces={["notifications"]}>
      <div className="mx-auto grid w-full max-w-[960px] grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-[clamp(32px,5vw,56px)]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
            <p className="mt-2 text-text-2">{t("subtitle")}</p>
          </div>
          {hasUnread ? <MarkAllReadButton /> : null}
        </header>

        {items.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center text-text-2">{t("empty")}</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((item) => {
              const unread = item.read_at === null;
              const text = sentence(item);
              const extra = detail(item);
              const href = notificationHref(item);
              return (
                <li key={item.id}>
                  <article className={cn("grid gap-2 rounded-3xl border bg-card p-5", unread ? "border-cyan/40" : "border-white/8")}>
                    <div className="flex items-start gap-3">
                      {unread ? <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-cyan" /> : <span aria-hidden="true" className="mt-2 size-2.5 shrink-0" />}
                      <div className="grid min-w-0 flex-1 gap-1">
                        <p className={cn("break-words", unread ? "font-semibold text-foreground" : "text-text-2")}>
                          {unread ? <span className="sr-only">{t("unread")}: </span> : null}
                          {href ? (
                            <a href={`/api/notifications/${item.id}?lang=${locale}`} className="rounded-sm hover:text-cyan hover:underline focus-visible:ring-2 focus-visible:ring-cyan focus-visible:outline-none">
                              {text}
                            </a>
                          ) : (
                            text
                          )}
                        </p>
                        {extra ? <p className="text-sm break-words whitespace-pre-line text-text-2">{extra}</p> : null}
                        {item.type === "moderation" && (item.data.action === "suspend" || item.data.action === "hide") ? (
                          <Link href="/settings/moderation" className="w-fit text-sm font-semibold text-cyan underline underline-offset-2 hover:text-white">
                            {t("appealLink")}
                          </Link>
                        ) : null}
                        <time dateTime={item.created_at} className="text-xs text-text-3">
                          {formatRelativeTime(locale, item.created_at, now)}
                        </time>
                      </div>
                    </div>
                    <NotificationActions id={item.id} read={!unread} />
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {before || nextBefore ? (
          <nav className="flex flex-wrap gap-3" aria-label={t("title")}>
            {before ? (
              <Button asChild variant="ghost" size="lg">
                <Link href="/notifications">{t("backToStart")}</Link>
              </Button>
            ) : null}
            {nextBefore ? (
              <Button asChild variant="outline" size="lg">
                <Link href={`/notifications?before=${encodeURIComponent(nextBefore)}`}>{t("older")}</Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </ExtraMessages>
  );
}
