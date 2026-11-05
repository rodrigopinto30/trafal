import { Suspense } from "react";
import { GameShelf } from "@/components/games/game-shelf";
import { GameSearch } from "@/components/search/game-search";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { listPublishedGames, searchGames } from "@/lib/games/queries";
import { firstParam } from "@/lib/validation/common";
import { parseSearchQuery } from "@/lib/validation/search";

const RESULTS_LIMIT = 48;

export async function generateMetadata() {
  const t = await getTranslations("explore");
  return { title: t("title") };
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("explore");
  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 px-5 pt-[clamp(32px,5vw,56px)]">
      <header className="grid gap-5">
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
        <Suspense fallback={<Skeleton className="h-14 w-full max-w-[640px] rounded-full" />}>
          <SearchBar searchParams={searchParams} />
        </Suspense>
      </header>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseSearchQuery(firstParam((await searchParams).q));
  return <GameSearch key={query ?? ""} variant="page" defaultValue={query ?? ""} />;
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [t, params] = await Promise.all([getTranslations("explore"), searchParams]);
  const query = parseSearchQuery(firstParam(params.q));
  const games = query ? await searchGames(query, RESULTS_LIMIT) : (await listPublishedGames()).slice(0, RESULTS_LIMIT);

  if (query && games.length === 0) {
    return (
      <section aria-labelledby="results-title" className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center">
        <h2 id="results-title" className="font-display text-xl font-bold">
          {t("emptyTitle", { query })}
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-text-2">{t("emptyText")}</p>
        <Button asChild variant="outline" size="lg" className="mt-6">
          <Link href="/explore">{t("showAll")}</Link>
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="results-title" className="grid gap-5">
      <div>
        <h2 id="results-title" className="font-display text-xl font-bold">
          {query ? t("subtitleResults", { query }) : t("subtitleAll")}
        </h2>
        <p className="mt-1 text-sm text-text-3" role="status">
          {t("count", { count: games.length })}
        </p>
      </div>
      <GameShelf games={games} columns={4} headingLevel={3} />
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-[300px] rounded-3xl" />
      ))}
    </div>
  );
}
