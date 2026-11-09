import { Suspense } from "react";
import { GameShelf } from "@/components/games/game-shelf";
import { SurpriseButton } from "@/components/games/surprise-button";
import { ExploreFilters } from "@/components/search/explore-filters";
import { GameSearch } from "@/components/search/game-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { exploreGames } from "@/lib/games/queries";
import { firstParam } from "@/lib/validation/common";
import { EXPLORE_PAGE_SIZE, exploreHref, hasFilters, parseExploreQuery } from "@/lib/validation/explore";
import { pageMetadata } from "@/lib/seo/metadata";
import { NoIndex } from "@/components/seo/no-index";

type RawParams = Promise<Record<string, string | string[] | undefined>>;

async function readQuery(searchParams: RawParams) {
  const raw = await searchParams;
  return parseExploreQuery({
    q: firstParam(raw.q),
    genre: firstParam(raw.genre),
    engine: firstParam(raw.engine),
    mobile: firstParam(raw.mobile),
    sort: firstParam(raw.sort),
    page: firstParam(raw.page),
  });
}

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("explore"), getLocale()]);
  return pageMetadata({ title: t("title"), description: t("subtitleAll"), path: "/explore", locale });
}

export default async function ExplorePage({ searchParams }: { searchParams: RawParams }) {
  const t = await getTranslations("explore");
  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 px-5 pt-[clamp(32px,5vw,56px)]">
      <header className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
          <SurpriseButton />
        </div>
        <Suspense fallback={<Skeleton className="h-14 w-full max-w-[640px] rounded-full" />}>
          <SearchBar searchParams={searchParams} />
        </Suspense>
      </header>
      <Suspense fallback={<Skeleton className="h-48 rounded-3xl" />}>
        <Filters searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBar({ searchParams }: { searchParams: RawParams }) {
  const query = await readQuery(searchParams);
  const keep = exploreHref(query, ["q", "page"]).split("?")[1] ?? "";
  return <GameSearch key={`${query.q ?? ""}|${keep}`} variant="page" defaultValue={query.q ?? ""} keep={keep} />;
}

async function Filters({ searchParams }: { searchParams: RawParams }) {
  const query = await readQuery(searchParams);
  return <ExploreFilters key={exploreHref({ ...query, page: 1 })} query={query} />;
}

async function Results({ searchParams }: { searchParams: RawParams }) {
  const [t, query] = await Promise.all([getTranslations("explore"), readQuery(searchParams)]);
  const { games, total } = await exploreGames(query, EXPLORE_PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / EXPLORE_PAGE_SIZE));
  const variant = exploreHref(query) !== "/explore" ? <NoIndex /> : null;

  if (games.length === 0) {
    const narrowed = hasFilters(query);
    return (
      <section aria-labelledby="results-title" className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center">
        {variant}
        <h2 id="results-title" className="font-display text-xl font-bold">
          {query.page > 1 ? t("pageEmpty") : query.q ? t("emptyTitle", { query: query.q }) : narrowed ? t("emptyFilteredTitle") : t("subtitleAll")}
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-text-2">{narrowed ? t("emptyFilteredText") : t("emptyText")}</p>
        <Button asChild variant="outline" size="lg" className="mt-6">
          <Link href={query.page > 1 ? exploreHref({ ...query, page: 1 }) : "/explore"}>{query.page > 1 ? t("prev") : t("showAll")}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="results-title" className="grid gap-5">
      {variant}
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

function ResultsSkeleton() {
  return (
    <div className="grid min-h-svh content-start gap-4 md:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-[300px] rounded-3xl" />
      ))}
    </div>
  );
}
