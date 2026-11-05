import { PlayIcon } from "lucide-react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { GameCover } from "@/components/games/game-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { formatCompactNumber } from "@/lib/format";
import type { GameSummary } from "@/lib/games/types";

type GameBannerProps = {
  game: GameSummary;
  eyebrow: string;
  cta: string;
  quote?: string | null;
};

/** Banner grande de un juego: toda la superficie lleva a la página del juego, donde se puede jugar sin cuenta. */
export async function GameBanner({ game, eyebrow, cta, quote }: GameBannerProps) {
  const [t, locale] = await Promise.all([getTranslations("games"), getLocale()]);
  const titleId = `banner-${game.public_id}`;

  return (
    <section aria-labelledby={titleId} className="mx-auto max-w-[1200px] px-5 pt-[clamp(56px,7vw,96px)]">
      <article className="relative isolate overflow-hidden rounded-[28px] border border-white/10 shadow-[0_0_40px_rgb(139_92_255/0.22)]">
        <GameCover game={game} className="absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-black/85 via-black/60 to-black/10 max-md:to-black/40" />

        <div className="relative flex min-h-[380px] max-w-[660px] flex-col justify-end gap-4 p-6 sm:p-10 md:min-h-[420px]">
          <Badge variant="violet">{eyebrow}</Badge>
          <h2 id={titleId} className="font-display text-[clamp(34px,6vw,60px)] leading-[1.02] font-bold text-white">
            {game.title}
          </h2>
          <p className="max-w-[52ch] text-base text-white/85 sm:text-lg">{game.short_description}</p>
          {quote ? <blockquote className="max-w-[52ch] border-l-2 border-cyan pl-4 text-sm text-white/80 italic">{quote}</blockquote> : null}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
            <span className="flex items-center gap-2">
              <UserAvatar username={game.owner.username} displayName={game.owner.display_name} avatarPath={game.owner.avatar_path} size="sm" alt="" />
              {game.owner.display_name}
            </span>
            <span className="flex items-center gap-1.5">
              <PlayIcon aria-hidden="true" className="size-3.5" />
              {formatCompactNumber(locale, game.play_count)}
              <span className="sr-only">{t("plays", { count: game.play_count })}</span>
            </span>
          </div>

          <div>
            <Button asChild variant="play" size="xl">
              <Link href={`/games/${game.public_id}`} aria-label={`${cta}: ${game.title}`} className="after:absolute after:inset-0 after:z-10">
                <PlayIcon aria-hidden="true" />
                {cta}
              </Link>
            </Button>
          </div>
        </div>
      </article>
    </section>
  );
}
