import { Suspense } from "react";
import { ReportActions } from "@/components/admin/report-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { listReports, countReports, type AdminReport } from "@/lib/admin/queries";
import { firstParam } from "@/lib/validation/common";
import { parseBefore, parseReportStatusFilter, REPORT_STATUS_FILTERS } from "@/lib/validation/admin";
import { cn } from "@/lib/utils";

export default function AdminReportsPage({ searchParams }: PageProps<"/[lang]/admin">) {
  return (
    <Suspense fallback={<Skeleton className="min-h-svh rounded-3xl" aria-hidden="true" />}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

const hrefOf = (filter: string, before?: string | null) => `/admin?${new URLSearchParams({ ...(filter !== "open" ? { status: filter } : {}), ...(before ? { before } : {}) }).toString()}`.replace(/\?$/, "");

function snapshotText(report: AdminReport): string {
  const snapshot = report.snapshot as Record<string, string | undefined>;
  if (report.target_type === "game") return [snapshot.title, snapshot.short_description].filter(Boolean).join(" — ");
  if (report.target_type === "profile") return [snapshot.display_name && `${snapshot.display_name} (@${snapshot.username})`, snapshot.bio].filter(Boolean).join(" — ");
  return snapshot.body ?? "";
}

async function Reports({ searchParams }: { searchParams: PageProps<"/[lang]/admin">["searchParams"] }) {
  const raw = await searchParams;
  const filter = parseReportStatusFilter(firstParam(raw.status));
  const before = parseBefore(firstParam(raw.before));
  const [t, locale, { reports, nextBefore }, counts] = await Promise.all([getTranslations("admin"), getLocale(), listReports(filter, before), countReports()]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section aria-labelledby="reports-title" className="grid gap-5">
      <h2 id="reports-title" className="sr-only">
        {t("reports.title")}
      </h2>
      <nav aria-label={t("filtersLabel")}>
        <ul className="flex flex-wrap gap-2">
          {REPORT_STATUS_FILTERS.map((status) => (
            <li key={status}>
              <Link
                href={hrefOf(status)}
                aria-current={filter === status ? "page" : undefined}
                className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-semibold text-text-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyan", filter === status && "bg-white/10 text-foreground")}
              >
                {t(`filters.${status}`)}
                <span className="text-text-3">{counts[status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {reports.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center text-text-2">{t(`reports.empty.${filter}`)}</p>
      ) : (
        <ul className="grid gap-4">
          {reports.map((report) => (
            <li key={report.id}>
              <article className="grid gap-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6" aria-label={`${t(`reports.targets.${report.target_type}`)} · ${t(`reports.reasons.${report.reason as "spam"}`)}`}>
                <header className="flex flex-wrap items-center gap-2">
                  <Badge variant="soft">{t(`reports.targets.${report.target_type}`)}</Badge>
                  <Badge variant="outline">{t(`reports.reasons.${report.reason as "spam"}`)}</Badge>
                  <Badge variant={report.status === "open" ? "coral" : report.status === "reviewing" ? "cyan" : "violet"}>{t(`reports.status.${report.status}`)}</Badge>
                  {report.target?.status ? <Badge variant={report.target.status === "published" ? "outline" : "coral"}>{t(`reports.targetStatus.${report.target.status as "published"}`)}</Badge> : null}
                  <span className="text-sm text-text-3">
                    {t("reports.by", { username: report.reporter?.username ?? "?" })} · {date.format(new Date(report.created_at))}
                  </span>
                </header>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold text-text-3 uppercase">{t("reports.whatWasReported")}</p>
                  <p className="whitespace-pre-line text-text-2">{snapshotText(report) || t("reports.unavailable")}</p>
                  {report.target?.href ? (
                    <Link href={report.target.href} className="mt-1 inline-flex min-h-11 w-fit items-center rounded-lg font-semibold text-cyan hover:underline">
                      {t("reports.viewTarget")}
                    </Link>
                  ) : null}
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold text-text-3 uppercase">{t("reports.detail")}</p>
                  <p className="whitespace-pre-line text-text-2">{report.detail || t("reports.noDetail")}</p>
                </div>

                {report.resolved_at ? (
                  <p className="text-sm text-text-2">
                    {t("reports.resolvedBy", { username: report.resolver?.username ?? "?" })} · {date.format(new Date(report.resolved_at))}
                    {report.resolution_note ? <span className="mt-1 block whitespace-pre-line">{t("reports.note")}: {report.resolution_note}</span> : null}
                  </p>
                ) : null}

                <ReportActions reportId={report.id} status={report.status} targetType={report.target_type} targetId={report.target_id} targetStatus={report.target?.status ?? null} />
              </article>
            </li>
          ))}
        </ul>
      )}

      {before || nextBefore ? (
        <nav className="flex flex-wrap gap-3" aria-label={t("reports.title")}>
          {before ? (
            <Button asChild variant="ghost" size="lg">
              <Link href={hrefOf(filter)}>{t("reports.backToStart")}</Link>
            </Button>
          ) : null}
          {nextBefore ? (
            <Button asChild variant="outline" size="lg">
              <Link href={hrefOf(filter, nextBefore)}>{filter === "resolved" ? t("reports.olderResolved") : t("reports.older")}</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
