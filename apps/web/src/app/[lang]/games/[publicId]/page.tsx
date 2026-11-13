import { MessageCircleIcon, PlayIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { CommentForm } from "@/components/games/comment-form";
import { CommentHighlight } from "@/components/games/comment-highlight";
import { CommentList, type CommentViewer } from "@/components/games/comment-list";
import { CreatorQuestions } from "@/components/games/creator-questions";
import { GamePlayerShell } from "@/components/games/game-player-shell";
import { JoinCard } from "@/components/games/join-card";
import { PostCard } from "@/components/games/post-card";
import { ShareButton } from "@/components/games/share-button";
import { SurpriseButton } from "@/components/games/surprise-button";
import { ReactionButtons } from "@/components/games/reaction-buttons";
import { VersionList } from "@/components/games/version-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { formatCompactNumber } from "@/lib/format";
import { groupComments } from "@/lib/games/comments";
import { findGameByPublicId, listCommentsByGame, listPostsByGame, listQuestionsByGame, listReadyVersions } from "@/lib/games/queries";
import { listMyReactions, type MyReactions } from "@/lib/games/reaction-queries";
import { parsePublicIdParam } from "@/lib/validation/common";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { excerpt } from "@/lib/seo/site";
import { gameData } from "@/lib/seo/structured-data";
import { ExtraMessages } from "@/components/i18n/extra-messages";

const NO_REACTIONS: MyReactions = { liked: new Set(), saved: new Set() };

type GamePageProps = PageProps<"/[lang]/games/[publicId]">;

export async function generateMetadata({ params }: GamePageProps) {
  const publicId = parsePublicIdParam((await params).publicId);
  const game = publicId ? await findGameByPublicId(publicId) : null;
  if (!game) return {};
  const locale = await getLocale();
  return pageMetadata({ title: game.title, description: excerpt(game.short_description, 160), path: `/games/${game.public_id}`, locale });
}

export default function GamePage({ params }: GamePageProps) {
  return (
    <div className="mx-auto max-w-[960px] px-5 pt-[clamp(24px,5vw,48px)]">
      <ExtraMessages namespaces={["gamePlayer", "comments"]}>
        <Suspense fallback={<GamePageSkeleton />}>
          <GameContent params={params} />
        </Suspense>
      </ExtraMessages>
    </div>
  );
}

async function GameContent({ params }: { params: GamePageProps["params"] }) {
  const publicId = parsePublicIdParam((await params).publicId);
  if (!publicId) notFound();
  const game = await findGameByPublicId(publicId);
  if (!game) notFound();

  const [t, tPosts, tGenres, locale, posts, comments, questions, versions, user] = await Promise.all([
    getTranslations("games"),
    getTranslations("posts"),
    getTranslations("genres"),
    getLocale(),
    listPostsByGame(game.id),
    listCommentsByGame(game.id),
    listQuestionsByGame(game.id),
    listReadyVersions(game.id),
    getAuthUser(),
  ]);
  const [myGame, myPosts] = user
    ? await Promise.all([listMyReactions("game", [game.id]), listMyReactions("post", posts.map((post) => post.id))])
    : [NO_REACTIONS, NO_REACTIONS];
  const loginHref = `/login?next=${encodeURIComponent(`/games/${game.public_id}`)}`;
  const viewer = { signedIn: Boolean(user), userId: user?.id, loginHref, mine: myPosts };
  const commentViewer: CommentViewer = { signedIn: Boolean(user), userId: user?.id, isTargetOwner: user?.id === game.owner_id, loginHref, target: "game", targetId: game.id };
  const now = new Date();
  const allThreads = groupComments(comments);
  const threads = allThreads.filter((thread) => thread.comment.question_id === null);
  const answers = allThreads.filter((thread) => thread.comment.question_id !== null);
  const { owner } = game;

  return (
    <div className="grid gap-10">
      <JsonLd data={gameData({ ...game, genre: game.genre_id, owner }, locale)} />
      <GamePlayerShell game={game} />

      <header className="grid gap-4">
        <ul className="flex flex-wrap gap-2">
          {game.genre_id ? (
            <li>
              <Badge variant="cyan">{tGenres(game.genre_id as Parameters<typeof tGenres>[0])}</Badge>
            </li>
          ) : null}
          {game.is_first_game ? (
            <li>
              <Badge variant="violet">{t("firstGame")}</Badge>
            </li>
          ) : null}
        </ul>

        <h1 className="font-display text-[clamp(30px,5vw,46px)] leading-[1.05] font-bold text-glow-violet">{game.title}</h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-text-2">
          <Link href={`/u/${owner.username}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-foreground hover:text-cyan">
            <UserAvatar username={owner.username} displayName={owner.display_name} avatarPath={owner.avatar_path} size="sm" alt="" />
            {owner.display_name}
          </Link>
          <span className="flex items-center gap-1.5">
            <PlayIcon aria-hidden="true" className="size-4" />
            {formatCompactNumber(locale, game.play_count)}
            <span className="sr-only">{t("plays", { count: game.play_count })}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircleIcon aria-hidden="true" className="size-4" />
            {comments.length}
            <span className="sr-only">{t("comments", { count: comments.length })}</span>
          </span>
          <ReactionButtons
            target="game"
            id={game.id}
            likeCount={game.like_count}
            initialLiked={myGame.liked.has(game.id)}
            initialSaved={myGame.saved.has(game.id)}
            signedIn={Boolean(user)}
            loginHref={loginHref}
            locale={locale}
          />
          <ShareButton path={`/games/${game.public_id}`} title={game.title} />
          <SurpriseButton exclude={game.public_id} variant="ghost" />
          {user?.id === game.owner_id ? (
            <Button asChild variant="outline">
              <Link href={`/games/${game.public_id}/edit`}>{t("edit")}</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="grid gap-10">
          <section aria-labelledby="about">
            <h2 id="about" className="font-display text-2xl font-bold">
              {t("about")}
            </h2>
            <p className="mt-3 text-lg text-text-2">{game.short_description}</p>
            {game.tags.length > 0 ? (
              <ul aria-label={t("tags")} className="mt-4 flex flex-wrap gap-2">
                {game.tags.map((tag) => (
                  <li key={tag}>
                    <Badge variant="outline">{tag}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {game.controls ? (
            <section aria-labelledby="how-to-play">
              <h2 id="how-to-play" className="font-display text-2xl font-bold">
                {t("howToPlay")}
              </h2>
              <p className="mt-3 whitespace-pre-line text-text-2">{game.controls}</p>
            </section>
          ) : null}

          {versions.length > 0 ? <VersionList versions={versions} activeVersionId={game.active_version_id} /> : null}

          <section aria-labelledby="devlogs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="devlogs" className="font-display text-2xl font-bold">
                {t("devlogsTitle")}
              </h2>
              {user?.id === game.owner_id ? (
                <Button asChild variant="outline">
                  <Link href={`/posts/new?game=${game.public_id}`}>{tPosts("publish")}</Link>
                </Button>
              ) : null}
            </div>
            {posts.length > 0 ? (
              <div className="mt-4 grid gap-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} now={now} showGame={false} viewer={viewer} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-text-2">{t("noDevlogs")}</p>
            )}
          </section>

          <CreatorQuestions questions={questions} answers={answers} creatorName={owner.display_name} now={now} viewer={commentViewer} />

          <section aria-labelledby="comments">
            <CommentHighlight />
            <h2 id="comments" className="font-display text-2xl font-bold">
              {t("commentsTitle")}
            </h2>
            <div className="mt-4 grid gap-6">
              <CommentForm target="game" id={game.id} signedIn={Boolean(user)} loginHref={loginHref} />
              {threads.length > 0 ? (
                <CommentList threads={threads} now={now} viewer={commentViewer} />
              ) : (
                <p className="text-text-2">{user ? t("noCommentsSignedIn") : t("noComments")}</p>
              )}
            </div>
          </section>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-28">
          <section aria-labelledby="creator" className="rounded-3xl border border-white/8 bg-card p-5">
            <h2 id="creator" className="sr-only">
              {t("creator")}
            </h2>
            <div className="flex items-center gap-4">
              <UserAvatar username={owner.username} displayName={owner.display_name} avatarPath={owner.avatar_path} size="lg" alt="" />
              <div className="min-w-0 leading-snug">
                <p className="truncate font-bold">{owner.display_name}</p>
                <p className="truncate text-sm text-text-3">@{owner.username}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href={`/u/${owner.username}`}>{t("viewProfile")}</Link>
            </Button>
          </section>

          {user ? null : (
            <JoinCard
              title={t("join.title")}
              text={t("join.text", { name: owner.display_name })}
              signupLabel={t("join.signup")}
              loginLabel={t("join.login")}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function GamePageSkeleton() {
  return (
    <div className="grid min-h-svh content-start gap-8" aria-hidden="true">
      <Skeleton className="mx-auto aspect-video w-full rounded-[28px]" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-40" />
    </div>
  );
}
