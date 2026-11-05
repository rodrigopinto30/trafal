import { HeartIcon } from "lucide-react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { formatRelativeTime } from "@/lib/format";
import type { CommunityHighlight } from "@/lib/games/types";

type CommunityQuoteProps = {
  highlight: CommunityHighlight;
  now: Date;
};

const linkClass = "inline-flex min-h-11 items-center truncate rounded-lg font-semibold text-foreground hover:text-cyan hover:underline";

export async function CommunityQuote({ highlight, now }: CommunityQuoteProps) {
  const [t, locale] = await Promise.all([getTranslations("games"), getLocale()]);
  const { author, game } = highlight;

  return (
    <figure className="flex h-full flex-col gap-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
      <Badge variant="coral" className="gap-1.5">
        <HeartIcon aria-hidden="true" className="size-3" />
        {t("commentLabels.liked")}
      </Badge>
      <blockquote className="text-base leading-relaxed text-foreground">“{highlight.body}”</blockquote>
      <figcaption className="mt-auto flex flex-col gap-1 text-sm text-text-3">
        <span className="flex items-center gap-3">
          <UserAvatar username={author.username} displayName={author.display_name} avatarPath={author.avatar_path} size="sm" alt="" />
          <Link href={`/u/${author.username}`} className={linkClass}>
            {author.display_name}
          </Link>
        </span>
        <span className="flex flex-wrap items-center gap-x-2">
          <Link href={`/games/${game.public_id}`} className={linkClass}>
            {game.title}
          </Link>
          <time dateTime={highlight.created_at}>{formatRelativeTime(locale, highlight.created_at, now)}</time>
        </span>
      </figcaption>
    </figure>
  );
}
