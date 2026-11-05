import { PlayIcon } from "lucide-react";
import { GameCover } from "@/components/games/game-cover";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/i18n/server";
import { parseDisplayRatio } from "@/lib/games/ratio";
import type { GameDetail } from "@/lib/games/types";

/** Marco del reproductor con la proporción del juego. Hasta que exista el reproductor seguro muestra la portada y avisa. */
export async function GamePlayerShell({ game }: { game: GameDetail }) {
  const t = await getTranslations("games");
  const { width, height } = parseDisplayRatio(game.display_ratio);

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-[28px] border border-white/10 shadow-[0_0_40px_rgb(139_92_255/0.2)]"
      style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(72vh * ${width} / ${height}))` }}
    >
      <GameCover game={game} className="absolute inset-0" />
      <div className="absolute inset-0 grid place-items-center bg-black/60 p-5 text-center">
        <div className="grid max-w-[420px] justify-items-center gap-3">
          <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{t("playerSoonTitle")}</h2>
          <p className="text-sm text-white/85 sm:text-base">{t("playerSoonText")}</p>
          <Button variant="play" size="xl" disabled>
            <PlayIcon aria-hidden="true" />
            {t("play")}
          </Button>
        </div>
      </div>
    </div>
  );
}
