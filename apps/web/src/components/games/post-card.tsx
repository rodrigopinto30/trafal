import { HeartIcon, MessageCircleIcon } from "lucide-react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { formatRelativeTime } from "@/lib/format";
import type { MyReactions } from "@/lib/games/reaction-queries";
import type { PostKind, PostSummary } from "@/lib/games/types";
import { PostMedia } from "./post-media";
import { PostOwnerMenu } from "./post-owner-menu";
import { ReactionButtons } from "./reaction-buttons";
import type { VariantProps } from "class-variance-authority";

/** What the card needs to let the person like and save: whether they have an account, where to log in, and their own marks. */
export type PostViewer = { signedIn: boolean; userId?: string; loginHref: string; mine: MyReactions };

type PostCardProps = {
  post: PostSummary;
  now: Date;
  showGame?: boolean;
  viewer?: PostViewer;
};

const KIND_VARIANTS: Record<PostKind, NonNullable<VariantProps<typeof badgeVariants>["variant"]>> = {
  nuevo_juego: "cyan",
  avance: "soft",
  pide_feedback: "outline",
  hito: "violet",
};

export async function PostCard({ post, now, showGame = true, viewer }: PostCardProps) {
  const [t, tPosts, locale] = await Promise.all([getTranslations("games"), getTranslations("posts"), getLocale()]);

  return (
    <article className="flex h-full flex-col gap-3 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
      <header className="flex items-center gap-3">
        <UserAvatar username={post.author.username} displayName={post.author.display_name} avatarPath={post.author.avatar_path} size="md" alt="" />
        <div className="flex min-w-0 flex-wrap items-center gap-x-3">
          <Link href={`/u/${post.author.username}`} className="inline-flex min-h-11 items-center truncate rounded-lg font-semibold text-foreground hover:text-cyan hover:underline">
            {post.author.display_name}
          </Link>
          <time dateTime={post.created_at} className="text-xs text-text-3">
            {formatRelativeTime(locale, post.created_at, now)}
          </time>
        </div>
        {viewer?.userId === post.author_id ? (
          <div className="ml-auto">
            <PostOwnerMenu postId={post.id} />
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        <Badge variant={KIND_VARIANTS[post.kind]}>{tPosts(`kinds.${post.kind}`)}</Badge>
        {post.highlight ? <Badge variant="outline">{post.highlight}</Badge> : null}
      </div>

      <p className="whitespace-pre-line text-text-2">{post.body}</p>

      <PostMedia media={post.media} />

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-4 text-sm text-text-3">
        {showGame && post.game ? (
          <Link href={`/games/${post.game.public_id}`} className="inline-flex min-h-11 items-center truncate rounded-lg font-semibold text-cyan hover:underline">
            {tPosts("inGame", { title: post.game.title })}
          </Link>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-3">
          {viewer ? (
            <ReactionButtons
              target="post"
              id={post.id}
              likeCount={post.like_count}
              initialLiked={viewer.mine.liked.has(post.id)}
              initialSaved={viewer.mine.saved.has(post.id)}
              signedIn={viewer.signedIn}
              loginHref={viewer.loginHref}
              locale={locale}
              compact
            />
          ) : (
            <span className="flex items-center gap-1">
              <HeartIcon aria-hidden="true" className="size-3.5 text-coral" />
              {post.like_count}
              <span className="sr-only">{t("likes", { count: post.like_count })}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageCircleIcon aria-hidden="true" className="size-3.5" />
            {post.comment_count}
            <span className="sr-only">{t("comments", { count: post.comment_count })}</span>
          </span>
        </span>
      </footer>
    </article>
  );
}
