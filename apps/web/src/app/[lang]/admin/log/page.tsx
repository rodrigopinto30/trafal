import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { listModerationLog } from "@/lib/admin/queries";
import { parseBefore } from "@/lib/validation/admin";
import { firstParam } from "@/lib/validation/common";

const LOG_ACTIONS = ["hide_game", "restore_game", "hide_post", "restore_post", "hide_comment", "restore_comment", "take_report", "dismiss_report", "action_report", "feature_game", "replace_featured_game", "unfeature_game", "suspend_account", "lift_suspension"] as const;
const LOG_TARGETS = ["game", "post", "comment", "report", "featured", "profile", "claim"] as const;

const isLogAction = (value: string): value is (typeof LOG_ACTIONS)[number] => (LOG_ACTIONS as readonly string[]).includes(value);
const isLogTarget = (value: string): value is (typeof LOG_TARGETS)[number] => (LOG_TARGETS as readonly string[]).includes(value);

export default function AdminLogPage({ searchParams }: PageProps<"/[lang]/admin/log">) {
  return (
    <Suspense fallback={<Skeleton className="min-h-svh rounded-3xl" aria-hidden="true" />}>
      <Log searchParams={searchParams} />
    </Suspense>
  );
}

async function Log({ searchParams }: { searchParams: PageProps<"/[lang]/admin/log">["searchParams"] }) {
  const before = parseBefore(firstParam((await searchParams).before));
  const [t, locale, { entries, nextBefore }] = await Promise.all([getTranslations("admin"), getLocale(), listModerationLog(before)]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const label = (action: string) => (isLogAction(action) ? t(`log.actions.${action}`) : action);
  const target = (type: string) => (isLogTarget(type) ? t(`log.targets.${type}`) : type);

  return (
    <section aria-labelledby="log-title" className="grid gap-5">
      <div>
        <h2 id="log-title" className="font-display text-2xl font-bold">
          {t("log.title")}
        </h2>
        <p className="mt-1 text-text-2">{t("log.subtitle")}</p>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center text-text-2">{t("log.empty")}</p>
      ) : (
        <div tabIndex={0} role="region" aria-label={t("log.title")} className="overflow-x-auto rounded-3xl border border-white/8 bg-card outline-none focus-visible:ring-2 focus-visible:ring-cyan">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-text-3">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t("log.when")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("log.admin")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("log.action")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("log.target")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("log.reason")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-text-2">{date.format(new Date(entry.created_at))}</td>
                  <td className="px-4 py-3 font-semibold">@{entry.admin_username}</td>
                  <td className="px-4 py-3">{label(entry.action)}</td>
                  <td className="px-4 py-3 text-text-2">{target(entry.target_type)}</td>
                  <td className="px-4 py-3 whitespace-pre-line text-text-2">{entry.reason ?? t("log.noReason")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {before || nextBefore ? (
        <nav className="flex flex-wrap gap-3" aria-label={t("log.title")}>
          {before ? (
            <Button asChild variant="ghost" size="lg">
              <Link href="/admin/log">{t("log.backToStart")}</Link>
            </Button>
          ) : null}
          {nextBefore ? (
            <Button asChild variant="outline" size="lg">
              <Link href={`/admin/log?before=${encodeURIComponent(nextBefore)}`}>{t("log.older")}</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
