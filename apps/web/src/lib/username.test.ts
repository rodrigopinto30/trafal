import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_USERNAMES, USERNAME_PATTERN, checkUsernameFormat, normalizeUsername, suggestUsernames } from "./username";

describe("checkUsernameFormat", () => {
  it.each([
    "valen_makes", "agus.codes", "benja8bit", "mateo_g", "abc", "a1b", "x".repeat(30),
    // «Si está libre, se puede usar»: no hace falta ningún número ni una forma especial.
    "rodri", "rodrigopinto", "_oculto_", "a__b", "a._b", "its_rodri",
  ])("acepta %s", (name) => {
    expect(checkUsernameFormat(name)).toBe("ok");
  });

  it.each(["", "a", "ab", ".abc", "abc.", "a..b", "___", "...", "con espacio", "con-guion", "x".repeat(31), "UPPER!", "emoji😀", "a@b"])(
    "rechaza %j",
    (name) => {
      expect(checkUsernameFormat(name)).toBe("invalid");
    },
  );

  it("normaliza mayúsculas, acentos y espacios antes de validar", () => {
    expect(normalizeUsername("  Valen_Makes ")).toBe("valen_makes");
    expect(normalizeUsername("Sofía_Dev")).toBe("sofia_dev");
    expect(normalizeUsername("ñandú")).toBe("nandu");
    expect(checkUsernameFormat("  Valen_Makes ")).toBe("ok");
    expect(checkUsernameFormat("ñandú")).toBe("ok");
  });

  it("marca los nombres reservados (sin distinguir mayúsculas)", () => {
    expect(checkUsernameFormat("admin")).toBe("reserved");
    expect(checkUsernameFormat("Trafal")).toBe("reserved");
    expect(checkUsernameFormat("SOPORTE")).toBe("reserved");
  });

  it("ya no reserva palabras que solo coinciden con rutas del sitio (los perfiles viven bajo /u/)", () => {
    for (const word of ["feed", "explore", "games", "juegos", "login", "settings", "legal"]) {
      expect(checkUsernameFormat(word), word).toBe("ok");
    }
  });
});

describe("suggestUsernames", () => {
  it("propone alternativas válidas y SIN números", () => {
    const suggestions = suggestUsernames("Rodri");
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    for (const suggestion of suggestions) {
      expect(checkUsernameFormat(suggestion), suggestion).toBe("ok");
      expect(suggestion).not.toMatch(/\d/);
      expect(suggestion).toContain("rodri");
    }
    expect(new Set(suggestions).size).toBe(suggestions.length);
  });
  it("descarta las que se pasan del largo máximo o quedan inválidas", () => {
    for (const suggestion of suggestUsernames("x".repeat(28))) expect(suggestion.length).toBeLessThanOrEqual(30);
    expect(suggestUsernames("")).toEqual([]);
    // «rodri.» + «.codes» tendría dos puntos seguidos: se descarta.
    expect(suggestUsernames("rodri.")).not.toContain("rodri..codes");
  });
});

describe("paridad con la base de datos", () => {
  const migrationsDir = path.resolve(process.cwd(), "../../supabase/migrations");
  const sql = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");

  it("la lista de reservados coincide con la ÚLTIMA definición de private.reserved_usernames()", () => {
    const blocks = [...sql.matchAll(/function private\.reserved_usernames\(\)[\s\S]*?select array\[([\s\S]*?)\];/g)];
    expect(blocks.length, "no se encontró private.reserved_usernames() en las migraciones").toBeGreaterThan(0);
    const latest = blocks[blocks.length - 1]?.[1] ?? "";
    const inDb = [...latest.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1] as string);
    expect([...inDb].sort()).toEqual([...RESERVED_USERNAMES].sort());
  });

  it("el patrón del @usuario es el de private.is_valid_username()", () => {
    const fn = /function private\.is_valid_username\(p_username text\)[\s\S]*?\$\$;/.exec(sql)?.[0] ?? "";
    expect(fn, "no se encontró private.is_valid_username() en las migraciones").not.toBe("");
    const pattern = /p_username ~ '([^']+)'/.exec(fn)?.[1];
    expect(pattern).toBe(USERNAME_PATTERN.source);
    // Las otras dos reglas de la función: sin «..» y con al menos una letra o un número.
    expect(fn).toContain("p_username !~ '\\.\\.'");
    expect(fn).toContain("p_username ~ '[a-z0-9]'");
  });
});
