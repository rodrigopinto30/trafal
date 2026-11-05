import type { ReactNode } from "react";
import { GenreIcon } from "@/components/profile/genre-icon";
import { coverArt } from "@/lib/games/cover";
import type { GameSummary } from "@/lib/games/types";
import { mediaUrl } from "@/lib/media/url";
import { cn } from "@/lib/utils";

type GameCoverProps = {
  game: Pick<GameSummary, "public_id" | "genre_id" | "cover_path">;
  className?: string;
  children?: ReactNode;
};

/** Portada del juego: la imagen que subió su creador o, si todavía no hay, un arte generado con el color de su género. */
export function GameCover({ game, className, children }: GameCoverProps) {
  const art = coverArt(game.genre_id, game.public_id);
  const imageUrl = mediaUrl(game.cover_path);

  return (
    <div className={cn("relative isolate overflow-hidden", className)} style={{ background: art.background }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : (
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
      {children}
    </div>
  );
}
