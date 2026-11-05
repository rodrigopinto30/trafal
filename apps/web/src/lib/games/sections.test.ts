import { describe, expect, it } from "vitest";
import { buildLandingSections } from "./sections";
import type { GameSummary } from "./types";

let counter = 0;

function game(overrides: Partial<GameSummary> = {}): GameSummary {
  counter += 1;
  return {
    id: `id-${counter}`,
    public_id: `game-${counter}`,
    title: `Juego ${String(counter).padStart(2, "0")}`,
    short_description: "",
    genre_id: "arcade",
    engine_id: "godot",
    tags: [],
    cover_path: null,
    works_on_mobile: true,
    is_first_game: false,
    display_ratio: "16:9",
    play_count: 0,
    like_count: 0,
    comment_count: 0,
    published_at: "2026-11-01T12:00:00Z",
    owner: { username: "creador", display_name: "Creador", avatar_path: null },
    ...overrides,
  };
}

describe("buildLandingSections", () => {
  it("ordena los recientes del más nuevo al más viejo y respeta el tope", () => {
    const games = Array.from({ length: 10 }, (_, day) => game({ published_at: `2026-11-${String(day + 1).padStart(2, "0")}T10:00:00Z` }));
    const { recent } = buildLandingSections(games);
    expect(recent).toHaveLength(8);
    expect(recent[0]?.published_at).toBe("2026-11-10T10:00:00Z");
    expect(recent.at(-1)?.published_at).toBe("2026-11-03T10:00:00Z");
  });

  it("ordena los más jugados de mayor a menor", () => {
    const games = [game({ play_count: 10 }), game({ play_count: 500 }), game({ play_count: 70 })];
    expect(buildLandingSections(games).mostPlayed.map((g) => g.play_count)).toEqual([500, 70, 10]);
  });

  it("desempata por título para que el orden sea estable", () => {
    const games = [game({ title: "B", play_count: 5 }), game({ title: "A", play_count: 5 })];
    expect(buildLandingSections(games).mostPlayed.map((g) => g.title)).toEqual(["A", "B"]);
  });

  it("el destacado es el más jugado, salvo el juego que ya es el banner de la semana", () => {
    const top = game({ play_count: 900 });
    const second = game({ play_count: 800 });
    expect(buildLandingSections([second, top]).spotlight?.id).toBe(top.id);
    expect(buildLandingSections([second, top], { excludeId: top.id }).spotlight?.id).toBe(second.id);
  });

  it("sin juegos no hay destacado ni secciones", () => {
    expect(buildLandingSections([])).toEqual({ spotlight: null, recent: [], mostPlayed: [], firstGames: [], genreShelves: [] });
  });

  it("los primeros juegos son solo los marcados, del más nuevo al más viejo", () => {
    const old = game({ is_first_game: true, published_at: "2026-10-01T00:00:00Z" });
    const fresh = game({ is_first_game: true, published_at: "2026-11-04T00:00:00Z" });
    const regular = game({ is_first_game: false });
    expect(buildLandingSections([old, regular, fresh]).firstGames.map((g) => g.id)).toEqual([fresh.id, old.id]);
  });

  it("arma estantes por género: los más numerosos primero, con sus juegos más jugados", () => {
    const games = [
      game({ genre_id: "puzzle", play_count: 1 }),
      game({ genre_id: "puzzle", play_count: 9 }),
      game({ genre_id: "arcade", play_count: 3 }),
      game({ genre_id: "arcade", play_count: 4 }),
      game({ genre_id: "arcade", play_count: 5 }),
      game({ genre_id: "cozy", play_count: 2 }),
      game({ genre_id: null, play_count: 99 }),
    ];
    const { genreShelves } = buildLandingSections(games, { limits: { genreShelves: 2, gamesPerShelf: 2 } });
    expect(genreShelves.map((shelf) => [shelf.genreId, shelf.total])).toEqual([["arcade", 3], ["puzzle", 2]]);
    expect(genreShelves[0]?.games.map((g) => g.play_count)).toEqual([5, 4]);
  });
});
