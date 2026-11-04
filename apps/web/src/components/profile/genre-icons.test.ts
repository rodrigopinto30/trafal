import { describe, expect, it } from "vitest";
import { GENRE_IDS } from "@/lib/profile/catalog";
import { GENRE_ICONS } from "./genre-icons";

describe("íconos de géneros", () => {
  it("hay un ícono para cada género del catálogo (y ninguno de más)", () => {
    expect(Object.keys(GENRE_ICONS).sort()).toEqual([...GENRE_IDS].sort());
  });
  it("los géneros tienen íconos distintos entre sí", () => {
    expect(new Set(Object.values(GENRE_ICONS)).size).toBe(GENRE_IDS.length);
  });
});
