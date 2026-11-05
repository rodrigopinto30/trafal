import { GameBanner } from "@/components/games/game-banner";
import { CommunityQuote } from "@/components/games/community-quote";
import { GameShelf } from "@/components/games/game-shelf";
import { JoinCard } from "@/components/games/join-card";
import { PostCard } from "@/components/games/post-card";
import { ShowcaseSection } from "@/components/games/showcase-section";
import { GenreIcon } from "@/components/profile/genre-icon";
import { getTranslations } from "@/i18n/server";
import { findFeaturedGame, listCommunityHighlights, listLatestPosts, listPublishedGames } from "@/lib/games/queries";
import { buildLandingSections } from "@/lib/games/sections";

const COMMUNITY_QUOTES = 5;
const LATEST_POSTS = 6;

/** Secciones de juegos y comunidad de la portada, intercaladas con banners grandes. Lee la base: va dentro de un <Suspense>. */
export async function LandingGames() {
  const [games, featured, highlights, posts] = await Promise.all([
    listPublishedGames(),
    findFeaturedGame(),
    listCommunityHighlights(COMMUNITY_QUOTES),
    listLatestPosts(LATEST_POSTS),
  ]);
  if (games.length === 0) return null;

  const now = new Date();
  const [t, tGenres] = await Promise.all([getTranslations("home"), getTranslations("genres")]);
  const sections = buildLandingSections(games, { excludeId: featured?.game.id });

  return (
    <>
      {sections.spotlight ? (
        <GameBanner game={sections.spotlight} eyebrow={t("sections.spotlight.eyebrow")} cta={t("sections.spotlight.cta")} />
      ) : null}

      <ShowcaseSection id="recent" title={t("sections.recent.title")} subtitle={t("sections.recent.subtitle")}>
        <GameShelf games={sections.recent} />
      </ShowcaseSection>

      <ShowcaseSection id="most-played" title={t("sections.mostPlayed.title")} subtitle={t("sections.mostPlayed.subtitle")}>
        <GameShelf games={sections.mostPlayed} ranked />
      </ShowcaseSection>

      {featured ? (
        <GameBanner game={featured.game} quote={featured.quote} eyebrow={t("sections.featured.eyebrow")} cta={t("sections.featured.cta")} />
      ) : null}

      <ShowcaseSection id="community" title={t("sections.community.title")} subtitle={t("sections.community.subtitle")}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {highlights.map((highlight) => (
            <CommunityQuote key={highlight.id} highlight={highlight} now={now} />
          ))}
          <JoinCard
            title={t("sections.community.joinTitle")}
            text={t("sections.community.joinText")}
            signupLabel={t("sections.community.joinCta")}
            loginLabel={t("sections.community.loginCta")}
          />
        </div>
      </ShowcaseSection>

      {sections.firstGames.length > 0 ? (
        <ShowcaseSection id="first-games" title={t("sections.firstGames.title")} subtitle={t("sections.firstGames.subtitle")}>
          <GameShelf games={sections.firstGames} />
        </ShowcaseSection>
      ) : null}

      <ShowcaseSection id="by-genre" title={t("sections.byGenre.title")} subtitle={t("sections.byGenre.subtitle")}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
          {sections.genreShelves.map((shelf) => (
            <div key={shelf.genreId}>
              <h3 className="mb-4 flex items-center gap-3 font-display text-xl font-bold">
                <GenreIcon id={shelf.genreId} className="size-6 text-cyan" />
                {tGenres(shelf.genreId as Parameters<typeof tGenres>[0])}
                <span className="text-sm font-normal text-text-3">{t("sections.byGenre.count", { count: shelf.total })}</span>
              </h3>
              <GameShelf games={shelf.games} headingLevel={4} />
            </div>
          ))}
        </div>
      </ShowcaseSection>

      {posts.length > 0 ? (
        <ShowcaseSection id="devlogs" title={t("sections.devlogs.title")} subtitle={t("sections.devlogs.subtitle")}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} now={now} />
            ))}
          </div>
        </ShowcaseSection>
      ) : null}
    </>
  );
}
