import { HeartIcon, LightbulbIcon } from "lucide-react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Badge } from "@/components/ui/badge";
import { CommentActions } from "@/components/games/comment-actions";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { formatRelativeTime } from "@/lib/format";
import type { CommentThread } from "@/lib/games/comments";
import type { CommentSummary } from "@/lib/games/types";
import type { CommentTarget } from "@/lib/validation/comment";

/** Who is looking and where the comments live: what the actions on each comment need. */
export type CommentViewer = { signedIn: boolean; userId?: string; isTargetOwner: boolean; loginHref: string; target: CommentTarget; targetId: string };

type CommentListProps = {
  threads: CommentThread[];
  now: Date;
  viewer: CommentViewer;
};

const EDITED_AFTER_MS = 60_000;

async function CommentBody({ comment, now, viewer, isReply }: { comment: CommentSummary; now: Date; viewer: CommentViewer; isReply: boolean }) {
  const [t, tc, locale] = await Promise.all([getTranslations("games"), getTranslations("comments"), getLocale()]);
  const edited = Date.parse(comment.updated_at) - Date.parse(comment.created_at) > EDITED_AFTER_MS;

  return (
    <article className="flex gap-3">
      <UserAvatar username={comment.author.username} displayName={comment.author.display_name} avatarPath={comment.author.avatar_path} size="md" alt="" className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/u/${comment.author.username}`} className="inline-flex min-h-11 items-center rounded-lg font-semibold text-foreground hover:text-cyan hover:underline">
            {comment.author.display_name}
          </Link>
          <time dateTime={comment.created_at} className="text-xs text-text-3">
            {formatRelativeTime(locale, comment.created_at, now)}
          </time>
          {edited ? <span className="text-xs text-text-3">({tc("edited")})</span> : null}
          {comment.label === "liked" ? (
            <Badge variant="coral" className="gap-1">
              <HeartIcon aria-hidden="true" className="size-3" />
              {t("commentLabels.liked")}
            </Badge>
          ) : null}
          {comment.label === "suggestion" ? (
            <Badge variant="cyan" className="gap-1">
              <LightbulbIcon aria-hidden="true" className="size-3" />
              {t("commentLabels.suggestion")}
            </Badge>
          ) : null}
          {comment.is_helpful ? <Badge variant="violet">{t("helpful")}</Badge> : null}
        </div>
        <p className="mt-1 whitespace-pre-line text-text-2">{comment.body}</p>
        <CommentActions
          commentId={comment.id}
          body={comment.body}
          label={comment.label}
          authorName={comment.author.display_name}
          isReply={isReply}
          isOwn={viewer.userId === comment.author_id}
          canMarkHelpful={viewer.isTargetOwner && !isReply && viewer.userId !== comment.author_id}
          helpful={comment.is_helpful}
          target={viewer.target}
          targetId={viewer.targetId}
          signedIn={viewer.signedIn}
          loginHref={viewer.loginHref}
        />
      </div>
    </article>
  );
}

export function CommentList({ threads, now, viewer }: CommentListProps) {
  return (
    <ul className="grid gap-4">
      {threads.map(({ comment, replies }) => (
        <li key={comment.id} className="rounded-3xl border border-white/8 bg-card p-5">
          <CommentBody comment={comment} now={now} viewer={viewer} isReply={false} />
          {replies.length > 0 ? (
            <ul className="mt-4 grid gap-4 border-l border-white/10 pl-4 sm:ml-12">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <CommentBody comment={reply} now={now} viewer={viewer} isReply />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
