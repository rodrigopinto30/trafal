import { Suspense } from "react";
import { CreatorCard } from "@/components/profile/creator-card";
import { CreatorsFilters } from "@/components/search/creators-filters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { exploreCreators, listFollowedAmong } from "@/lib/games/queries";
import { firstParam } from "@/lib/validation/common";
import { CREATORS_PAGE_SIZE, creatorsHref, hasCreatorFilters, parseCreatorsQuery } from "@/lib/validation/creators";

type RawParams = Promise<Record<string, string | string[] | undefined>>;

async function readQuery(searchParams: RawParams) {
  const raw = await searchParams;
  return parseCreatorsQuery({ q: firstParam(raw.q), engine: firstParam(raw.engine), genre: firstParam(raw.genre), sort: firstParam(raw.sort), page: firstParam(raw.page) });
}

export async function generateMetadata() {
  const t = await getTranslations("creators");
  return { title: t("title"), description: t("subtitle") };
}

export default async function CreatorsPage({ searchParams }: { searchParams: RawParams }) {
  const t = await getTranslations("creators");
  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 px-5 pt-[clamp(32px,5vw,56px)]">
      <header className="grid gap-3">
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
        <p className="max-w-[640px] text-text-2">{t("subtitle")}</p>
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

async function Filters({ searchParams }: { searchParams: RawParams }) {
  const query = await readQuery(searchParams);
  return <CreatorsFilters key={creatorsHref({ ...query, page: 1 })} query={query} />;
}

async function Results({ searchParams }: { searchParams: RawParams }) {
  const [t, query, user] = await Promise.all([getTranslations("creators"), readQuery(searchParams), getAuthUser()]);
  const { creators, total } = await exploreCreators(query, CREATORS_PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / CREATORS_PAGE_SIZE));
  const following = user ? await listFollowedAmong(user.id, creators.map((creator) => creator.id)) : new Set<string>();

  if (creators.length === 0) {
    return (
      <section aria-labelledby="results-title" className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center">
        <h2 id="results-title" className="font-display text-xl font-bold">
          {query.page > 1 ? t("pageEmpty") : t("emptyTitle")}
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-text-2">{t("emptyText")}</p>
        {query.page > 1 || query.q || hasCreatorFilters(query) ? (
          <Button asChild variant="outline" size="lg" className="mt-6">
            <Link href={query.page > 1 ? creatorsHref({ ...query, page: 1 }) : "/creators"}>{query.page > 1 ? t("prev") : t("showAll")}</Link>
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <section aria-labelledby="results-title" className="grid gap-5">
      <h2 id="results-title" className="sr-only">
        {t("listLabel")}
      </h2>
      <p className="text-sm text-text-3" role="status">
        {t("count", { count: total })}
      </p>
      <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
        {creators.map((creator) => (
          <li key={creator.id}>
            <CreatorCard creator={creator} signedIn={Boolean(user)} isOwn={user?.id === creator.id} following={following.has(creator.id)} />
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <nav aria-label={t("pagination")} className="flex flex-wrap items-center gap-3">
          {query.page > 1 ? (
            <Button asChild variant="outline" size="lg">
              <Link href={creatorsHref({ ...query, page: query.page - 1 })} rel="prev">
                {t("prev")}
              </Link>
            </Button>
          ) : null}
          <span className="text-sm text-text-2">{t("pageOf", { page: query.page, pages })}</span>
          {query.page < pages ? (
            <Button asChild variant="outline" size="lg">
              <Link href={creatorsHref({ ...query, page: query.page + 1 })} rel="next">
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-56 rounded-3xl" />
      ))}
    </div>
  );
}
