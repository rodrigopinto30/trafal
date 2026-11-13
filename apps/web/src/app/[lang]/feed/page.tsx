import { Suspense } from "react";
import { FeedFilters } from "@/components/games/feed-filters";
import { PostCard } from "@/components/games/post-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { listFeed } from "@/lib/games/queries";
import { listMyReactions } from "@/lib/games/reaction-queries";
import { firstParam } from "@/lib/validation/common";
import { FEED_PAGE_SIZE, feedHref, parseFeedQuery } from "@/lib/validation/feed";
import { pageMetadata } from "@/lib/seo/metadata";
import { NoIndex } from "@/components/seo/no-index";

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("feed"), getLocale()]);
  return pageMetadata({ title: t("title"), description: t("subtitle"), path: "/feed", locale });
}

export default async function FeedPage({ searchParams }: PageProps<"/[lang]/feed">) {
  const t = await getTranslations("feed");
  return (
    <div className="mx-auto grid max-w-[720px] grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-[clamp(24px,5vw,48px)]">
      <header>
        <h1 className="font-display text-[clamp(30px,5vw,46px)] leading-[1.05] font-bold text-glow-violet">{t("title")}</h1>
        <p className="mt-2 max-w-[640px] text-text-2">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<FeedSkeleton />}>
        <FeedContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FeedContent({ searchParams }: { searchParams: PageProps<"/[lang]/feed">["searchParams"] }) {
  const raw = await searchParams;
  const user = await getAuthUser();
  const query = parseFeedQuery({ kind: firstParam(raw.kind), scope: firstParam(raw.scope), before: firstParam(raw.before) });
  const scope = user ? query.scope : "all";
  const effective = { ...query, scope };

  const [t, page] = await Promise.all([
    getTranslations("feed"),
    listFeed({ kind: effective.kind, followerId: scope === "following" && user ? user.id : null, before: effective.before, limit: FEED_PAGE_SIZE }),
  ]);
  const mine = user ? await listMyReactions("post", page.posts.map((post) => post.id)) : { liked: new Set<string>(), saved: new Set<string>() };
  const here = feedHref(effective);
  const viewer = { signedIn: Boolean(user), userId: user?.id, loginHref: `/login?next=${encodeURIComponent(here)}`, mine };
  const now = new Date();

  return (
    <>
      {here !== "/feed" ? <NoIndex /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <FeedFilters query={effective} signedIn={Boolean(user)} />
        {user ? (
          <Button asChild>
            <Link href="/posts/new">{t("publish")}</Link>
          </Button>
        ) : null}
      </div>

      {page.posts.length > 0 ? (
        <div className="grid gap-4">
          {page.posts.map((post, index) => (
            <PostCard key={post.id} post={post} now={now} viewer={viewer} eagerMedia={index === 0} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center">
          <p className="mx-auto max-w-[520px] text-text-2">{scope === "following" ? t("empty.following") : effective.kind === "all" ? t("empty.all") : t("empty.kind")}</p>
          {effective.before ? (
            <Button asChild variant="outline" size="lg" className="mt-5">
              <Link href={feedHref({ ...effective, before: null })}>{t("backToStart")}</Link>
            </Button>
          ) : null}
        </div>
      )}

      {page.nextBefore || effective.before ? (
        <nav className="flex flex-wrap gap-3" aria-label={t("title")}>
          {effective.before ? (
            <Button asChild variant="ghost" size="lg">
              <Link href={feedHref({ ...effective, before: null })}>{t("backToStart")}</Link>
            </Button>
          ) : null}
          {page.nextBefore ? (
            <Button asChild variant="outline" size="lg">
              <Link href={feedHref({ ...effective, before: page.nextBefore })}>{t("older")}</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

function FeedSkeleton() {
  return (
    <div className="grid min-h-svh content-start gap-4" aria-hidden="true">
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-52 rounded-3xl" />
    </div>
  );
}
