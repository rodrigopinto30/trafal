import { Suspense } from "react";
import { ClaimActions } from "@/components/admin/claim-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { countClaims, listClaims } from "@/lib/admin/queries";
import { parseBefore, parseReportStatusFilter, REPORT_STATUS_FILTERS } from "@/lib/validation/admin";
import { firstParam } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

export default function AdminClaimsPage({ searchParams }: PageProps<"/[lang]/admin/claims">) {
  return (
    <Suspense fallback={<Skeleton className="min-h-svh rounded-3xl" aria-hidden="true" />}>
      <Claims searchParams={searchParams} />
    </Suspense>
  );
}

const hrefOf = (filter: string, before?: string | null) => `/admin/claims?${new URLSearchParams({ ...(filter !== "open" ? { status: filter } : {}), ...(before ? { before } : {}) }).toString()}`.replace(/\?$/, "");

async function Claims({ searchParams }: { searchParams: PageProps<"/[lang]/admin/claims">["searchParams"] }) {
  const raw = await searchParams;
  const filter = parseReportStatusFilter(firstParam(raw.status));
  const before = parseBefore(firstParam(raw.before));
  const [t, locale, { claims, nextBefore }, counts] = await Promise.all([getTranslations("admin"), getLocale(), listClaims(filter, before), countClaims()]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section aria-labelledby="claims-title" className="grid gap-5">
      <div>
        <h2 id="claims-title" className="font-display text-2xl font-bold">
          {t("claims.title")}
        </h2>
        <p className="mt-1 max-w-[720px] text-text-2">{t("claims.subtitle")}</p>
      </div>
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

      {claims.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center text-text-2">{t(`claims.empty.${filter}`)}</p>
      ) : (
        <ul className="grid gap-4">
          {claims.map((claim) => (
            <li key={claim.id}>
              <article aria-label={`${t("claims.claimBy", { name: claim.claimant_name })}`} className="grid gap-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
                <header className="flex flex-wrap items-center gap-2">
                  <Badge variant={claim.status === "open" ? "coral" : claim.status === "reviewing" ? "cyan" : "violet"}>{t(`reports.status.${claim.status}`)}</Badge>
                  <span className="text-sm text-text-3">{date.format(new Date(claim.created_at))}</span>
                  <span className="text-xs text-text-3">#{claim.id.slice(0, 8).toUpperCase()}</span>
                </header>

                <div className="grid gap-1 text-sm">
                  <p className="text-xs font-semibold text-text-3 uppercase">{t("claims.claimant")}</p>
                  <p className="text-text-2">
                    {claim.claimant_name}
                    {claim.claimant_org ? ` · ${claim.claimant_org}` : ""} ·{" "}
                    <a href={`mailto:${claim.claimant_email}`} className="text-cyan underline underline-offset-2 hover:text-white">
                      {claim.claimant_email}
                    </a>
                  </p>
                  <p className="text-text-3">{t("claims.signedBy", { signature: claim.signature })}</p>
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold text-text-3 uppercase">{t("claims.work")}</p>
                  <p className="whitespace-pre-line text-text-2">{claim.work_description}</p>
                  {claim.original_url ? (
                    <a href={claim.original_url} rel="noopener noreferrer nofollow" target="_blank" className="w-fit break-all text-sm text-cyan hover:underline">
                      {claim.original_url}
                    </a>
                  ) : null}
                </div>

                <div className="grid gap-1">
                  <p className="text-xs font-semibold text-text-3 uppercase">{t("claims.claimed")}</p>
                  <ul className="grid gap-1 text-sm text-text-2">
                    {claim.game ? (
                      <li className="flex flex-wrap items-center gap-2">
                        <Badge variant="soft">{t("reports.targets.game")}</Badge>
                        <Link href={`/games/${claim.game.public_id}`} className="font-semibold text-cyan hover:underline">
                          {claim.game.title}
                        </Link>
                        <Badge variant={claim.game.status === "published" ? "outline" : "coral"}>{t(`reports.targetStatus.${claim.game.status as "published"}`)}</Badge>
                      </li>
                    ) : null}
                    {claim.post ? (
                      <li className="flex flex-wrap items-center gap-2">
                        <Badge variant="soft">{t("reports.targets.post")}</Badge>
                        <Link href={`/posts/${claim.post.id}`} className="font-semibold text-cyan hover:underline">
                          {claim.post.body.slice(0, 80)}
                        </Link>
                        <Badge variant={claim.post.status === "published" ? "outline" : "coral"}>{t(`reports.targetStatus.${claim.post.status as "published"}`)}</Badge>
                      </li>
                    ) : null}
                  </ul>
                  <p className="mt-1 text-xs text-text-3">{t("claims.links")}</p>
                  <ul className="grid gap-0.5 text-sm break-all text-text-3">
                    {claim.infringing_urls.map((url) => (
                      <li key={url}>{url}</li>
                    ))}
                  </ul>
                </div>

                {claim.handled_at ? (
                  <p className="text-sm text-text-2">
                    {t("reports.resolvedBy", { username: claim.handler?.username ?? "?" })} · {date.format(new Date(claim.handled_at))}
                    {claim.resolution_note ? (
                      <span className="mt-1 block whitespace-pre-line">
                        {t("reports.note")}: {claim.resolution_note}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                <ClaimActions claimId={claim.id} status={claim.status} game={claim.game_id && claim.game ? { id: claim.game_id, status: claim.game.status } : null} post={claim.post_id && claim.post ? { id: claim.post_id, status: claim.post.status } : null} />
              </article>
            </li>
          ))}
        </ul>
      )}

      {before || nextBefore ? (
        <nav className="flex flex-wrap gap-3" aria-label={t("claims.title")}>
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
