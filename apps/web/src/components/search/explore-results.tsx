import { GameShelf } from "@/components/games/game-shelf";
import { NoIndex } from "@/components/seo/no-index";
import { ExploreFilters } from "@/components/search/explore-filters";
import { GameSearch } from "@/components/search/game-search";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { exploreGames } from "@/lib/games/queries";
import { EXPLORE_PAGE_SIZE, exploreHref, hasFilters, type ExploreQuery } from "@/lib/validation/explore";

/** The search box of the home: it keeps the filters and replaces the text (and goes back to the first page). */
export function ExploreSearchBar({ query }: { query: ExploreQuery }) {
  const keep = exploreHref(query, ["q", "page"]).split("?")[1] ?? "";
  return <GameSearch key={`${query.q ?? ""}|${keep}`} variant="page" defaultValue={query.q ?? ""} keep={keep} />;
}

/** Genre and order. They go in the address, so the form is rebuilt when the view changes. */
export function ExploreFilterBar({ query }: { query: ExploreQuery }) {
  return <ExploreFilters key={exploreHref({ ...query, page: 1 })} query={query} />;
}

/**
 * The games that match the address (a search, filters, an order or a later page), a page at a time. These views are variants of the
 * home, so they ask search engines not to index them. Reads the database: it goes inside <Suspense>.
 */
export async function ExploreResults({ query }: { query: ExploreQuery }) {
  const [t, { games, total }] = await Promise.all([getTranslations("explore"), exploreGames(query, EXPLORE_PAGE_SIZE)]);
  const pages = Math.max(1, Math.ceil(total / EXPLORE_PAGE_SIZE));

  if (games.length === 0) {
    const narrowed = hasFilters(query);
    return (
      <section aria-labelledby="results-title" className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center">
        <NoIndex />
        <h2 id="results-title" className="font-display text-xl font-bold">
          {query.page > 1 ? t("pageEmpty") : query.q ? t("emptyTitle", { query: query.q }) : narrowed ? t("emptyFilteredTitle") : t("subtitleAll")}
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-text-2">{narrowed ? t("emptyFilteredText") : t("emptyText")}</p>
        <Button asChild variant="outline" size="lg" className="mt-6">
          <Link href={query.page > 1 ? exploreHref({ ...query, page: 1 }) : "/"}>{query.page > 1 ? t("prev") : t("showAll")}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="results-title" className="grid gap-5">
      <NoIndex />
      <div>
        <h2 id="results-title" className="font-display text-xl font-bold">
          {query.q ? t("subtitleResults", { query: query.q }) : t("subtitleAll")}
        </h2>
        <p className="mt-1 text-sm text-text-3" role="status">
          {t("count", { count: total })}
        </p>
      </div>
      <GameShelf games={games} columns={4} headingLevel={3} />
      {pages > 1 ? (
        <nav aria-label={t("pagination")} className="flex flex-wrap items-center gap-3">
          {query.page > 1 ? (
            <Button asChild variant="outline" size="lg">
              <Link href={exploreHref({ ...query, page: query.page - 1 })} rel="prev">
                {t("prev")}
              </Link>
            </Button>
          ) : null}
          <span className="text-sm text-text-2">{t("pageOf", { page: query.page, pages })}</span>
          {query.page < pages ? (
            <Button asChild variant="outline" size="lg">
              <Link href={exploreHref({ ...query, page: query.page + 1 })} rel="next">
                {t("next")}
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
