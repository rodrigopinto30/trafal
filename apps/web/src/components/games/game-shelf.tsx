import { GameCard } from "@/components/games/game-card";
import type { GameSummary } from "@/lib/games/types";

type GameShelfProps = {
  games: GameSummary[];
  ranked?: boolean;
  columns?: 3 | 4;
  headingLevel?: 3 | 4;
};

const WIDE_COLUMNS = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" } as const;

/** Fila de tarjetas: se desliza con el dedo en celular y pasa a grilla desde tabletas. */
export function GameShelf({ games, ranked = false, columns = 4, headingLevel = 3 }: GameShelfProps) {
  return (
    <ul className={`-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 ${WIDE_COLUMNS[columns]}`}>
      {games.map((game, index) => (
        <li key={game.id} className="w-[78%] max-w-[340px] shrink-0 snap-start md:w-auto md:max-w-none">
          <GameCard game={game} rank={ranked ? index + 1 : undefined} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
