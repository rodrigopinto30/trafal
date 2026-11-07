import { Suspense } from "react";
import { GameShelf } from "@/components/games/game-shelf";
import { PostCard } from "@/components/games/post-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { listMyReactions, listSavedGames, listSavedPosts } from "@/lib/games/reaction-queries";

export async function generateMetadata() {
  const t = await getTranslations("saved");
  return { title: t("title"), robots: { index: false } };
}

export default async function SavedPage() {
  const t = await getTranslations("saved");
  return (
    <div className="mx-auto grid w-full max-w-[960px] grid-cols-[minmax(0,1fr)] gap-8 px-5 pt-[clamp(32px,5vw,56px)]">
      <header>
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
        <p className="mt-2 text-text-2">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<SavedSkeleton />}>
        <SavedContent />
      </Suspense>
    </div>
  );
}

async function SavedContent() {
  const { user } = await requireProfile("/saved");
  const [t, games, posts] = await Promise.all([getTranslations("saved"), listSavedGames(user.id), listSavedPosts(user.id)]);
  const mine = await listMyReactions("post", posts.map((post) => post.id));
  const viewer = { signedIn: true, userId: user.id, loginHref: "/login?next=%2Fsaved", mine };
  const now = new Date();

  return (
    <>
      <section aria-labelledby="saved-games" className="grid gap-4">
        <h2 id="saved-games" className="font-display text-2xl font-bold">
          {t("gamesTitle")}
        </h2>
        {games.length > 0 ? (
          <GameShelf games={games} columns={3} headingLevel={3} />
        ) : (
          <div className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center">
            <p className="text-text-2">{t("emptyGames")}</p>
            <Button asChild size="lg" className="mt-5">
              <Link href="/explore">{t("explore")}</Link>
            </Button>
          </div>
        )}
      </section>
      <section aria-labelledby="saved-posts" className="grid gap-4">
        <h2 id="saved-posts" className="font-display text-2xl font-bold">
          {t("postsTitle")}
        </h2>
        {posts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} now={now} viewer={viewer} />
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center text-text-2">{t("emptyPosts")}</p>
        )}
      </section>
    </>
  );
}

function SavedSkeleton() {
  return (
    <div className="grid gap-8" aria-hidden="true">
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}
