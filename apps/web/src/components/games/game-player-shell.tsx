import { GamePlayer } from "@/components/games/game-player";
import { getAuthUser } from "@/lib/auth/dal";
import { publicEnv } from "@/lib/env";
import { gameFrameUrl } from "@/lib/games/frame-url";
import { findGameDelivery } from "@/lib/games/queries";
import type { GameDetail } from "@/lib/games/types";

/** Looks up what the player needs (whether the game can be played, whether the visitor is signed in) and renders it. A draft is never served by the games domain: its owner sees why. */
export async function GamePlayerShell({ game, draft = false }: { game: GameDetail; draft?: boolean }) {
  const [delivery, user] = await Promise.all([draft ? null : findGameDelivery(game.public_id), getAuthUser()]);
  const frameUrl = delivery ? gameFrameUrl(publicEnv.gamesBaseUrl, game.public_id) : null;
  return <GamePlayer game={game} frameUrl={frameUrl} needsIsolation={delivery?.needsIsolation ?? false} signedIn={user !== null} draft={draft} />;
}
