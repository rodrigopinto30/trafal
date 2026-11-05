import { HeartIcon, PlayIcon } from "lucide-react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { GameCover } from "@/components/games/game-cover";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { formatCompactNumber } from "@/lib/format";
import type { GameSummary } from "@/lib/games/types";

type GameCardProps = {
  game: GameSummary;
  rank?: number;
  headingLevel?: 3 | 4;
};

export async function GameCard({ game, rank, headingLevel = 3 }: GameCardProps) {
  const Heading = headingLevel === 3 ? "h3" : "h4";
  const [t, tGenres, tEngines, locale] = await Promise.all([
    getTranslations("games"),
    getTranslations("genres"),
    getTranslations("engines"),
    getLocale(),
  ]);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/8 bg-card transition-shadow duration-200 focus-within:shadow-card-hover hover:shadow-card-hover">
      <GameCover game={game} className="aspect-[16/10]">
        {rank ? (
          <span className="absolute top-3 left-3 grid h-10 min-w-10 place-items-center rounded-xl bg-black/65 px-2 font-pixel text-xl text-white">
            <span aria-hidden="true">{rank}</span>
            <span className="sr-only">{t("rank", { position: rank })}</span>
          </span>
        ) : null}
        {game.is_first_game ? (
          <Badge variant="violet" className="absolute top-3 right-3">
            {t("firstGame")}
          </Badge>
        ) : null}
      </GameCover>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Heading className="font-display text-lg leading-snug font-bold">
          <Link
            href={`/games/${game.public_id}`}
            className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-3xl focus-visible:after:ring-2 focus-visible:after:ring-cyan"
          >
            {game.title}
          </Link>
        </Heading>
        <p className="line-clamp-2 text-sm text-text-2">{game.short_description}</p>

        <ul className="flex flex-wrap gap-1.5">
          {game.genre_id ? (
            <li>
              <Badge variant="cyan">{tGenres(game.genre_id as Parameters<typeof tGenres>[0])}</Badge>
            </li>
          ) : null}
          {game.engine_id ? (
            <li>
              <Badge variant="soft">{tEngines(game.engine_id as Parameters<typeof tEngines>[0])}</Badge>
            </li>
          ) : null}
        </ul>

        <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm text-text-3">
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar username={game.owner.username} displayName={game.owner.display_name} avatarPath={game.owner.avatar_path} size="sm" alt="" />
            <span className="truncate">{game.owner.display_name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1" title={t("plays", { count: game.play_count })}>
              <PlayIcon aria-hidden="true" className="size-3.5" />
              {formatCompactNumber(locale, game.play_count)}
              <span className="sr-only">{t("plays", { count: game.play_count })}</span>
            </span>
            <span className="flex items-center gap-1" title={t("likes", { count: game.like_count })}>
              <HeartIcon aria-hidden="true" className="size-3.5 text-coral" />
              {formatCompactNumber(locale, game.like_count)}
              <span className="sr-only">{t("likes", { count: game.like_count })}</span>
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
