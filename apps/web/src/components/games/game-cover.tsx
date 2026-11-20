import type { ReactNode } from "react";
import { GameGif } from "@/components/games/game-gif";
import { GenreIcon } from "@/components/profile/genre-icon";
import { coverArt } from "@/lib/games/cover";
import type { GameSummary } from "@/lib/games/types";
import { mediaUrl } from "@/lib/media/url";
import { cn } from "@/lib/utils";

type GameCoverProps = {
  game: Pick<GameSummary, "public_id" | "genre_id" | "cover_path"> & { gif_path?: string | null };
  className?: string;
  children?: ReactNode;
};

/**
 * The picture of a game: its GIF when there is one, otherwise the cover its creator uploaded, otherwise an art generated with the
 * color of its genre.
 */
export function GameCover({ game, className, children }: GameCoverProps) {
  const art = coverArt(game.genre_id, game.public_id);
  const coverUrl = mediaUrl(game.cover_path);
  const gifUrl = mediaUrl(game.gif_path ?? null);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 isolate overflow-hidden" style={{ background: art.background }}>
        {coverUrl ? null : (
          <>
            <span aria-hidden="true" className="absolute inset-0 bg-dots opacity-40 [background-size:14px_14px]" />
            <span
              aria-hidden="true"
              className="absolute aspect-square h-[58%] -translate-x-1/2 -translate-y-1/2 text-white/20 [&>svg]:size-full [&>svg]:stroke-[1.2]"
              style={{ left: `${art.iconOffset.x}%`, top: `${art.iconOffset.y}%` }}
            >
              <GenreIcon id={game.genre_id ?? "other"} />
            </span>
          </>
        )}
        {coverUrl && !gifUrl ? <img src={coverUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" /> : null}
      </div>
      {gifUrl ? <GameGif gifUrl={gifUrl} coverUrl={coverUrl} /> : null}
      {children}
    </div>
  );
}
