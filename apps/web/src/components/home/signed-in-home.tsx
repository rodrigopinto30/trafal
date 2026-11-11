import { ArrowRightIcon, BellIcon } from "lucide-react";
import { Suspense } from "react";
import { PostCard } from "@/components/games/post-card";
import { ShowcaseSection } from "@/components/games/showcase-section";
import { SurpriseButton } from "@/components/games/surprise-button";
import { LandingGames } from "@/components/home/landing-games";
import { LandingSkeleton } from "@/components/home/landing-skeleton";
import { VisitorHome } from "@/components/home/visitor-home";
import { GameSearch } from "@/components/search/game-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { getAuthUser, requireProfile } from "@/lib/auth/dal";
import { listFeed, listMyGamesOverview } from "@/lib/games/queries";
import { listMyReactions } from "@/lib/games/reaction-queries";
import { countUnreadNotifications } from "@/lib/notifications/queries";

const OWN_GAMES_SHOWN = 4;
const FOLLOWING_POSTS_SHOWN = 6;

const STATUS_VARIANTS = { published: "cyan", draft: "soft", hidden: "coral", removed: "coral" } as const;

/**
 * The home of someone who is signed in: a greeting, what is waiting for them (notifications, their games, news from the people
 * they follow) and, below, the same shelves of games as the public home. It reads the session, so it goes inside <Suspense>.
 * If the session turns out not to be valid after all, it shows the public home instead of leaving the screen empty.
 */
export async function SignedInHome() {
  if (!(await getAuthUser())) return <VisitorHome />;
  const { user, profile } = await requireProfile("/", { allowOutdatedTerms: true });

  const [t, unread, myGames, following] = await Promise.all([
    getTranslations("home"),
    countUnreadNotifications(),
    listMyGamesOverview(user.id, OWN_GAMES_SHOWN),
    listFeed({ kind: "all", followerId: user.id, before: null, limit: FOLLOWING_POSTS_SHOWN }),
  ]);
  const mine = await listMyReactions("post", following.posts.map((post) => post.id));
  const viewer = { signedIn: true, userId: user.id, loginHref: "/login", mine };
  const firstName = profile.display_name.trim().split(/\s+/)[0] ?? profile.display_name;
  const now = new Date();
  const summary = unread === 0 ? t("signedIn.unreadNone") : unread === 1 ? t("signedIn.unreadOne") : t("signedIn.unreadMany", { count: unread });

  return (
    <>
      <section className="mx-auto max-w-[980px] px-5 pt-[clamp(32px,5vw,56px)] text-center">
        <h1 className="font-display text-[clamp(34px,5.4vw,56px)] leading-[1.06] font-bold tracking-tight text-glow-violet">
          {t.rich("signedIn.greeting", { name: firstName }, { accent: (chunks) => <span className="text-gradient">{chunks}</span> })}
        </h1>
        <p className="mx-auto mt-3 flex max-w-[620px] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg text-text-2">
          {summary}
          {unread > 0 ? (
            <Link href="/notifications" className="inline-flex items-center gap-1.5 font-semibold text-cyan underline underline-offset-2 hover:text-white">
              <BellIcon aria-hidden="true" className="size-4" />
              {t("signedIn.seeNotifications")}
            </Link>
          ) : null}
        </p>

        <div className="mt-7">
          <GameSearch variant="hero" />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3 max-sm:flex-col">
          <Button size="lg" asChild className="shadow-[0_0_24px_rgb(139_92_255/0.6),0_0_52px_rgb(46_230_255/0.22)]">
            <Link href="/posts/new">
              {t("signedIn.publish")}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/games/new">{t("signedIn.upload")}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/saved">{t("signedIn.saved")}</Link>
          </Button>
          <SurpriseButton size="lg" />
        </div>
      </section>

      <section aria-labelledby="your-space" className="mx-auto max-w-[1200px] px-5 pt-[clamp(48px,6vw,80px)]">
        <h2 id="your-space" className="sr-only">
          {t("signedIn.yourSpace")}
        </h2>
        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <article aria-labelledby="your-games" className="grid content-start gap-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
            <h3 id="your-games" className="font-display text-xl font-bold">
              {t("signedIn.yourGames.title")}
            </h3>
            {myGames.length === 0 ? (
              <div className="grid justify-items-start gap-4">
                <p className="text-text-2">{t("signedIn.yourGames.empty")}</p>
                <Button asChild>
                  <Link href="/games/new">{t("signedIn.yourGames.emptyCta")}</Link>
                </Button>
              </div>
            ) : (
              <ul className="grid gap-3">
                {myGames.map((game) => (
                  <li key={game.public_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-white/8 px-4 py-3">
                    <div className="grid min-w-0 gap-1">
                      <Link href={game.status === "published" ? `/games/${game.public_id}` : `/games/${game.public_id}/manage`} className="truncate font-semibold hover:text-cyan">
                        {game.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-2 text-sm text-text-3">
                        <Badge variant={STATUS_VARIANTS[game.status as keyof typeof STATUS_VARIANTS] ?? "soft"}>{t(`signedIn.yourGames.status.${game.status as "published"}`)}</Badge>
                        {game.status === "published" ? (
                          <span>
                            {t("signedIn.yourGames.plays", { count: game.play_count })} · {t("signedIn.yourGames.likes", { count: game.like_count })}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Link href={`/games/${game.public_id}/manage`} className="text-sm font-semibold text-cyan underline underline-offset-2 hover:text-white">
                      {t("signedIn.yourGames.manage")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article aria-labelledby="your-activity" className="grid content-start gap-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
            <h3 id="your-activity" className="font-display text-xl font-bold">
              {t("signedIn.activity.title")}
            </h3>
            <ul className="grid gap-3">
              {[
                { key: "unread", href: "/notifications", value: unread, highlight: unread > 0 },
                { key: "followers", href: `/u/${profile.username}/followers`, value: profile.followers_count, highlight: false },
                { key: "following", href: `/u/${profile.username}/following`, value: profile.following_count, highlight: false },
              ].map((stat) => (
                <li key={stat.key}>
                  <Link
                    href={stat.href}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-white/8 px-4 py-3 outline-none transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-cyan"
                  >
                    <span className="text-text-2">{t(`signedIn.activity.${stat.key as "unread"}`)}</span>
                    <span className={stat.highlight ? "rounded-full bg-cyan px-2.5 py-0.5 text-sm font-bold text-ink" : "font-display text-lg font-bold"}>{stat.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <ShowcaseSection id="following-news" title={t("signedIn.following.title")} subtitle={t("signedIn.following.subtitle")} className="pt-[clamp(48px,6vw,80px)]">
        {following.posts.length === 0 ? (
          <div className="grid justify-items-start gap-4 rounded-3xl border border-dashed border-white/20 px-6 py-8">
            <p className="text-text-2">{profile.following_count === 0 ? t("signedIn.following.empty") : t("signedIn.following.quiet")}</p>
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

      <Suspense fallback={<LandingSkeleton />}>
        <LandingGames signedIn />
      </Suspense>
    </>
  );
}
