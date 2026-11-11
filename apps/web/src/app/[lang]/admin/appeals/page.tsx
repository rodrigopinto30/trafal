import { Suspense } from "react";
import { AppealActions } from "@/components/admin/appeal-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { countAppeals, listAppeals } from "@/lib/admin/queries";
import { APPEAL_FILTERS, parseAppealFilter } from "@/lib/validation/appeal";
import { firstParam, parseBefore } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

export default function AdminAppealsPage({ searchParams }: PageProps<"/[lang]/admin/appeals">) {
  return (
    <Suspense fallback={<Skeleton className="min-h-svh rounded-3xl" aria-hidden="true" />}>
      <Appeals searchParams={searchParams} />
    </Suspense>
  );
}

const hrefOf = (filter: string, before?: string | null) => `/admin/appeals?${new URLSearchParams({ ...(filter !== "open" ? { status: filter } : {}), ...(before ? { before } : {}) }).toString()}`.replace(/\?$/, "");

async function Appeals({ searchParams }: { searchParams: PageProps<"/[lang]/admin/appeals">["searchParams"] }) {
  const raw = await searchParams;
  const filter = parseAppealFilter(firstParam(raw.status));
  const before = parseBefore(firstParam(raw.before));
  const [t, locale, { appeals, nextBefore }, counts] = await Promise.all([getTranslations("admin"), getLocale(), listAppeals(filter, before), countAppeals()]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section aria-labelledby="appeals-title" className="grid gap-5">
      <div>
        <h2 id="appeals-title" className="font-display text-2xl font-bold">
          {t("appeals.title")}
        </h2>
        <p className="mt-1 max-w-[720px] text-text-2">{t("appeals.subtitle")}</p>
      </div>
      <nav aria-label={t("filtersLabel")}>
        <ul className="flex flex-wrap gap-2">
          {APPEAL_FILTERS.map((status) => (
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

      {appeals.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center text-text-2">{t(`appeals.empty.${filter}`)}</p>
      ) : (
        <ul className="grid gap-4">
          {appeals.map((appeal) => (
            <li key={appeal.id}>
              <article aria-label={t("appeals.by", { username: appeal.appellant?.username ?? "?" })} className="grid gap-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
                <header className="flex flex-wrap items-center gap-2">
                  <Badge variant={appeal.status === "open" ? "coral" : "violet"}>{appeal.status === "open" ? t("reports.status.open") : t(`appeals.outcome.${appeal.status}`)}</Badge>
                  {appeal.kind === "counter_notice" ? <Badge variant="cyan">{t("appeals.kind.counter_notice")}</Badge> : null}
                  <span className="text-sm text-text-3">{date.format(new Date(appeal.created_at))}</span>
                  <span className="text-xs text-text-3">#{appeal.id.slice(0, 8).toUpperCase()}</span>
                </header>

                <div className="grid gap-1 text-sm">
                  <p className="text-xs font-semibold text-text-3 uppercase">{t("appeals.appellant")}</p>
                  <p className="text-text-2">
                    {appeal.appellant ? (
                      <Link href={`/u/${appeal.appellant.username}`} className="font-semibold text-cyan hover:underline">
                        @{appeal.appellant.username}
                      </Link>
                    ) : (
                      "?"
                    )}
                    {appeal.appellant ? ` · ${appeal.appellant.display_name}` : ""}
                  </p>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold text-text-3 uppercase">{t("appeals.decision")}</p>
                  <p className="font-semibold break-words text-foreground">{t(`appeals.target.${appeal.target_type}`, { label: appeal.target_label })}</p>
                  {appeal.decision_at ? <p className="text-xs text-text-3">{t("appeals.decisionOn", { date: date.format(new Date(appeal.decision_at)) })}</p> : null}
                  {appeal.decision_reason ? <p className="text-sm break-words whitespace-pre-line text-text-2">{t("appeals.reason", { reason: appeal.decision_reason })}</p> : null}
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold text-text-3 uppercase">{t("appeals.message")}</p>
                  <p className="break-words whitespace-pre-line text-text-2">{appeal.message}</p>
                </div>

                {appeal.kind === "counter_notice" ? (
                  <>
                    <div className="grid gap-1 text-sm">
                      <p className="text-xs font-semibold text-text-3 uppercase">{t("appeals.counterContact")}</p>
                      <p className="text-text-2">
                        {appeal.counter_name} ·{" "}
                        <a href={`mailto:${appeal.counter_email}`} className="text-cyan underline underline-offset-2 hover:text-white">
                          {appeal.counter_email}
                        </a>
                      </p>
                      <p className="text-text-3">{t("appeals.statementsMade")}</p>
                      <p className="text-text-3">{t("appeals.counterHint")}</p>
                    </div>
                    {appeal.claim ? (
                      <div className="grid gap-1 text-sm">
                        <p className="text-xs font-semibold text-text-3 uppercase">{t("appeals.claimTitle")}</p>
                        <p className="text-text-2">
                          {t("appeals.claimant")}: {appeal.claim.claimant_name}
                          {appeal.claim.claimant_org ? ` · ${appeal.claim.claimant_org}` : ""} ·{" "}
                          <a href={`mailto:${appeal.claim.claimant_email}`} className="text-cyan underline underline-offset-2 hover:text-white">
                            {appeal.claim.claimant_email}
                          </a>
                        </p>
                        <p className="break-words whitespace-pre-line text-text-2">
                          {t("appeals.work")}: {appeal.claim.work_description}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {appeal.resolved_at ? (
                  <p className="text-sm text-text-2">
                    {t("reports.resolvedBy", { username: appeal.resolver?.username ?? "?" })} · {date.format(new Date(appeal.resolved_at))}
                    {appeal.resolution_note ? (
                      <span className="mt-1 block whitespace-pre-line">{t("appeals.answer", { note: appeal.resolution_note })}</span>
                    ) : null}
                  </p>
                ) : (
                  <AppealActions appealId={appeal.id} targetType={appeal.target_type} />
                )}
              </article>
            </li>
          ))}
        </ul>
      )}

      {before || nextBefore ? (
        <nav className="flex flex-wrap gap-3" aria-label={t("appeals.title")}>
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
