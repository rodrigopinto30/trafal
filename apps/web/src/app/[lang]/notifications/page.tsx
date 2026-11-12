import { Suspense } from "react";
import { ExtraMessages } from "@/components/i18n/extra-messages";
import { MarkAllReadButton } from "@/components/notifications/notification-actions";
import { NotificationList, type NotificationRow } from "@/components/notifications/notification-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { formatRelativeTime } from "@/lib/format";
import { notificationHref } from "@/lib/notifications/href";
import { notificationDetail, notificationSentence } from "@/lib/notifications/text";
import { listNotifications } from "@/lib/notifications/queries";
import { firstParam, parseBefore } from "@/lib/validation/common";

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

async function Notifications({ searchParams }: { searchParams: PageProps<"/[lang]/notifications">["searchParams"] }) {
  await requireProfile("/notifications");
  const before = parseBefore(firstParam((await searchParams).before));
  const [t, locale, { items, nextBefore }] = await Promise.all([getTranslations("notifications"), getLocale(), listNotifications(before)]);
  const now = new Date();
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" });
  const hasUnread = items.some((item) => item.read_at === null);

  const rows: NotificationRow[] = items.map((item) => ({
    id: item.id,
    text: notificationSentence(item, t),
    detail: notificationDetail(item, t, (date) => day.format(date)),
    href: notificationHref(item) ? `/api/notifications/${item.id}?lang=${locale}` : null,
    createdAt: item.created_at,
    when: formatRelativeTime(locale, item.created_at, now),
    unread: item.read_at === null,
    offersAppeal: item.type === "moderation" && (item.data.action === "suspend" || item.data.action === "hide"),
  }));

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
          <NotificationList rows={rows} />
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
