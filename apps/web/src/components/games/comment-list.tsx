import { HeartIcon, LightbulbIcon } from "lucide-react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { formatRelativeTime } from "@/lib/format";
import type { CommentThread } from "@/lib/games/comments";
import type { CommentSummary } from "@/lib/games/types";

type CommentListProps = {
  threads: CommentThread[];
  now: Date;
};

async function CommentBody({ comment, now }: { comment: CommentSummary; now: Date }) {
  const [t, locale] = await Promise.all([getTranslations("games"), getLocale()]);

  return (
    <div className="flex gap-3">
      <UserAvatar username={comment.author.username} displayName={comment.author.display_name} avatarPath={comment.author.avatar_path} size="md" alt="" className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/u/${comment.author.username}`} className="inline-flex min-h-11 items-center rounded-lg font-semibold text-foreground hover:text-cyan hover:underline">
            {comment.author.display_name}
          </Link>
          <time dateTime={comment.created_at} className="text-xs text-text-3">
            {formatRelativeTime(locale, comment.created_at, now)}
          </time>
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
      </div>
    </div>
  );
}

export function CommentList({ threads, now }: CommentListProps) {
  return (
    <ul className="grid gap-4">
      {threads.map(({ comment, replies }) => (
        <li key={comment.id} className="rounded-3xl border border-white/8 bg-card p-5">
          <CommentBody comment={comment} now={now} />
          {replies.length > 0 ? (
            <ul className="mt-4 grid gap-4 border-l border-white/10 pl-4 sm:ml-12">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <CommentBody comment={reply} now={now} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
