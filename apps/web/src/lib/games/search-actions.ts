"use server";

import { searchGames } from "@/lib/games/queries";
import type { GameSuggestion } from "@/lib/games/types";
import { parseSuggestionQuery } from "@/lib/validation/search";

const SUGGESTIONS_LIMIT = 5;

/** Sugerencias mientras se escribe en el buscador. El texto viene del navegador: se sanea y se valida antes de usarlo. */
export async function suggestGamesAction(rawQuery: unknown): Promise<GameSuggestion[]> {
  const query = parseSuggestionQuery(rawQuery);
  if (query === null) return [];
  const games = await searchGames(query, SUGGESTIONS_LIMIT);
  return games.map((game) => ({
    public_id: game.public_id,
    title: game.title,
    genre_id: game.genre_id,
    cover_path: game.cover_path,
    creator: game.owner.display_name,
  }));
}
