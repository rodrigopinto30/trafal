import { describe, expect, it } from "vitest";
import { GENRE_IDS } from "@/lib/profile/catalog";
import { coverArt, hasCoverPalette } from "./cover";

describe("coverArt", () => {
  it("cada género del catálogo tiene su paleta", () => {
    expect(GENRE_IDS.filter((id) => !hasCoverPalette(id))).toEqual([]);
  });

  it("es determinístico para el mismo juego", () => {
    expect(coverArt("puzzle", "orbita")).toEqual(coverArt("puzzle", "orbita"));
  });

  it("juegos del mismo género se ven distintos", () => {
    const seeds = ["neon-express", "chancleta-run", "colectivo-152"];
    const backgrounds = new Set(seeds.map((seed) => coverArt("arcade", seed).background));
    expect(backgrounds.size).toBe(seeds.length);
  });

  it("sin género o con uno desconocido usa la paleta neutra", () => {
    expect(coverArt(null, "x").background).toContain("#1b1050");
    expect(coverArt("no-existe", "x").background).toContain("#1b1050");
  });

  it("deja el ícono dentro de la portada", () => {
    for (const seed of ["a", "b", "c", "juego largo", "otro"]) {
      const { x, y } = coverArt("horror", seed).iconOffset;
      expect(x).toBeGreaterThanOrEqual(55);
      expect(x).toBeLessThan(80);
      expect(y).toBeGreaterThanOrEqual(35);
      expect(y).toBeLessThan(65);
    }
  });
});
