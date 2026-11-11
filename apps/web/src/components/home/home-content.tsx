import { Suspense } from "react";
import { GameShelf } from "@/components/games/game-shelf";
import { PostCard } from "@/components/games/post-card";
import { ShowcaseSection } from "@/components/games/showcase-section";
import { SurpriseButton } from "@/components/games/surprise-button";
import { VisitorHome } from "@/components/home/visitor-home";
import { ExploreFilterBar, ExploreResults, ExploreSearchBar } from "@/components/search/explore-results";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { getAuthUser, requireProfile } from "@/lib/auth/dal";
import { listFeed, listPublishedGames } from "@/lib/games/queries";
import { listMyReactions } from "@/lib/games/reaction-queries";
import { buildLandingSections } from "@/lib/games/sections";
import { firstParam } from "@/lib/validation/common";
import { EXPLORE_SORTS, isExploring, parseExploreQuery } from "@/lib/validation/explore";

type RawParams = Promise<Record<string, string | string[] | undefined>>;

const FOLLOWING_POSTS_SHOWN = 6;
const SECTION_CLASS = "mx-0 w-full max-w-none px-0 pt-0";

/**
 * What «/» shows when it is not the static public home: the search view (a search, filters, an order or a later page, for anyone) or
 * the home of someone who is signed in. Both have the same shape: a title, the search box and the filters; then either the results or,
 * for the signed-in person with nothing searched, the news from who they follow and shelves of games. It reads the address and the
 * session, so it goes inside <Suspense>. A visitor with nothing searched (for example a session that turned out not to be valid) gets
 * the public home.
 */
export async function HomeContent({ searchParams }: { searchParams: RawParams }) {
  const raw = await searchParams;
  const query = parseExploreQuery({ q: firstParam(raw.q), genre: firstParam(raw.genre), engine: firstParam(raw.engine), mobile: firstParam(raw.mobile), sort: firstParam(raw.sort), page: firstParam(raw.page) });
  const exploring = isExploring(query) || EXPLORE_SORTS.some((sort) => sort === firstParam(raw.sort));
  const user = await getAuthUser();
  if (!user && !exploring) return <VisitorHome />;

  const signedIn = user ? await requireProfile("/", { allowOutdatedTerms: true }) : null;
  const t = await getTranslations("home");
  const firstName = signedIn ? (signedIn.profile.display_name.trim().split(/\s+/)[0] ?? signedIn.profile.display_name) : null;

  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 px-5 pt-[clamp(32px,5vw,56px)]">
      <header className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">
            {firstName ? t.rich("signedIn.greeting", { name: firstName }, { accent: (chunks) => <span className="text-gradient">{chunks}</span> }) : t("search.title")}
          </h1>
          <SurpriseButton />
        </div>
        <ExploreSearchBar query={query} />
      </header>
      <ExploreFilterBar query={query} />
      {exploring ? (
        <Suspense fallback={<ResultsSkeleton />}>
          <ExploreResults query={query} />
        </Suspense>
      ) : signedIn ? (
        <Suspense fallback={<ResultsSkeleton />}>
          <SignedInShelves userId={signedIn.user.id} followingCount={signedIn.profile.following_count} />
        </Suspense>
      ) : null}
    </div>
  );
}

/** The news from the people they follow and the shelves of games, with no banners. Reads the database: inside <Suspense>. */
async function SignedInShelves({ userId, followingCount }: { userId: string; followingCount: number }) {
  const [t, games, following] = await Promise.all([
    getTranslations("home"),
    listPublishedGames(),
    listFeed({ kind: "all", followerId: userId, before: null, limit: FOLLOWING_POSTS_SHOWN }),
  ]);
  const mine = await listMyReactions("post", following.posts.map((post) => post.id));
  const viewer = { signedIn: true, userId, loginHref: "/login", mine };
  const sections = buildLandingSections(games, {});
  const now = new Date();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-14">
      <ShowcaseSection id="following-news" title={t("signedIn.following.title")} subtitle={t("signedIn.following.subtitle")} className={SECTION_CLASS}>
        {following.posts.length === 0 ? (
          <div className="grid justify-items-start gap-4 rounded-3xl border border-dashed border-white/20 px-6 py-8">
            <p className="text-text-2">{followingCount === 0 ? t("signedIn.following.empty") : t("signedIn.following.quiet")}</p>
            <Button asChild variant="outline">
              <Link href="/creators">{t("signedIn.following.discover")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {following.posts.map((post) => (
                <PostCard key={post.id} post={post} now={now} viewer={viewer} />
              ))}
            </div>
            <Button asChild variant="outline" size="lg" className="mt-6">
              <Link href="/feed?scope=following">{t("signedIn.following.more")}</Link>
            </Button>
          </>
        )}
      </ShowcaseSection>

      {sections.recent.length > 0 ? (
        <ShowcaseSection id="recent" title={t("signedIn.recent.title")} subtitle={t("signedIn.recent.subtitle")} className={SECTION_CLASS}>
          <GameShelf games={sections.recent} />
        </ShowcaseSection>
      ) : null}

      {sections.mostPlayed.length > 0 ? (
        <ShowcaseSection id="most-played" title={t("signedIn.mostPlayed.title")} subtitle={t("signedIn.mostPlayed.subtitle")} className={SECTION_CLASS}>
          <GameShelf games={sections.mostPlayed} ranked />
        </ShowcaseSection>
      ) : null}

      {sections.firstGames.length > 0 ? (
        <ShowcaseSection id="first-games" title={t("signedIn.firstGames.title")} subtitle={t("signedIn.firstGames.subtitle")} className={SECTION_CLASS}>
          <GameShelf games={sections.firstGames} />
        </ShowcaseSection>
      ) : null}
    </div>
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

