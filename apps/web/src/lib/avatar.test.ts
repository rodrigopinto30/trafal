import { describe, expect, it } from "vitest";
import { AVATAR_GRADIENTS, avatarGradient, avatarInitial } from "./avatar";

describe("avatarGradient", () => {
  it("es determinístico y no distingue mayúsculas", () => {
    expect(avatarGradient("valen_makes")).toEqual(avatarGradient("valen_makes"));
    expect(avatarGradient("Valen_Makes")).toEqual(avatarGradient("valen_makes"));
  });
  it("siempre devuelve uno de los degradés de la paleta", () => {
    for (const seed of ["a", "mateo_g", "equipo_trafal", "x".repeat(40), "ñandú", ""]) {
      expect(AVATAR_GRADIENTS).toContainEqual(avatarGradient(seed));
    }
  });
  it("reparte usuarios distintos entre varios degradés", () => {
    const used = new Set(Array.from({ length: 60 }, (_, i) => avatarGradient(`user_${i}`).join()));
    expect(used.size).toBeGreaterThan(4);
  });
});

describe("avatarInitial", () => {
  it("usa la primera letra del nombre en mayúscula", () => {
    expect(avatarInitial("valentina ruiz", "valen")).toBe("V");
    expect(avatarInitial("Ñandú", "x")).toBe("Ñ");
  });
  it("cae al usuario si no hay nombre", () => {
    expect(avatarInitial("   ", "mateo_g")).toBe("M");
  });
  it("no rompe emojis (usa el primer carácter completo)", () => {
    expect(avatarInitial("🎮 Gamer", "g")).toBe("🎮");
  });
});
