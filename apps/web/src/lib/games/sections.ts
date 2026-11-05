import type { GameSummary } from "./types";

export type GenreShelf = {
  genreId: string;
  total: number;
  games: GameSummary[];
};

export type LandingSections = {
  spotlight: GameSummary | null;
  recent: GameSummary[];
  mostPlayed: GameSummary[];
  firstGames: GameSummary[];
  genreShelves: GenreShelf[];
};

type SectionLimits = {
  recent: number;
  mostPlayed: number;
  firstGames: number;
  genreShelves: number;
  gamesPerShelf: number;
};

export const DEFAULT_SECTION_LIMITS: SectionLimits = {
  recent: 8,
  mostPlayed: 8,
  firstGames: 4,
  genreShelves: 3,
  gamesPerShelf: 4,
};

const byMostPlayed = (a: GameSummary, b: GameSummary) => b.play_count - a.play_count || a.title.localeCompare(b.title);

const byNewest = (a: GameSummary, b: GameSummary) =>
  Date.parse(b.published_at ?? "") - Date.parse(a.published_at ?? "") || a.title.localeCompare(b.title);

function buildGenreShelves(games: GameSummary[], limits: SectionLimits): GenreShelf[] {
  const byGenre = new Map<string, GameSummary[]>();
  for (const game of games) {
    if (!game.genre_id) continue;
    byGenre.set(game.genre_id, [...(byGenre.get(game.genre_id) ?? []), game]);
  }
  return [...byGenre.entries()]
    .map(([genreId, members]) => ({
      genreId,
      total: members.length,
      games: [...members].sort(byMostPlayed).slice(0, limits.gamesPerShelf),
    }))
    .sort((a, b) => b.total - a.total || a.genreId.localeCompare(b.genreId))
    .slice(0, limits.genreShelves);
}

/** Reparte los juegos publicados en las secciones de la portada; `excludeId` evita repetir el juego del banner destacado. */
export function buildLandingSections(
  games: GameSummary[],
  options: { excludeId?: string; limits?: Partial<SectionLimits> } = {},
): LandingSections {
  const limits = { ...DEFAULT_SECTION_LIMITS, ...options.limits };
  const mostPlayed = [...games].sort(byMostPlayed);
  const spotlight = mostPlayed.find((game) => game.id !== options.excludeId) ?? null;

  return {
    spotlight,
    recent: [...games].sort(byNewest).slice(0, limits.recent),
    mostPlayed: mostPlayed.slice(0, limits.mostPlayed),
    firstGames: games.filter((game) => game.is_first_game).sort(byNewest).slice(0, limits.firstGames),
    genreShelves: buildGenreShelves(games, limits),
  };
}
