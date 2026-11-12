import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { GENRE_IDS, countryOptions, isCountryCode } from "./catalog";

/** Filas `(id, sort, ...)` que las migraciones siembran en una tabla de catálogo, ordenadas por `sort` (como la grilla). */
function seeded(table: "genres"): string[] {
  const dir = path.resolve(process.cwd(), "../../supabase/migrations");
  const sql = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(dir, file), "utf8"))
    .join("\n");
  const rows: { id: string; sort: number }[] = [];
  for (const block of sql.matchAll(new RegExp(`insert into public\\.${table}[^;]*?values([\\s\\S]*?);`, "g"))) {
    for (const row of (block[1] ?? "").matchAll(/\(\s*'([a-z0-9_]+)'\s*,\s*(\d+)/g)) {
      rows.push({ id: row[1] as string, sort: Number(row[2]) });
    }
  }
  return rows.sort((a, b) => a.sort - b.sort).map((row) => row.id);
}

describe("catálogos", () => {
  it("los ids coinciden con los nombres traducidos (es y en)", () => {
    expect([...GENRE_IDS].sort()).toEqual(Object.keys(es.genres).sort());
    expect(Object.keys(en.genres).sort()).toEqual(Object.keys(es.genres).sort());
  });

  it("coinciden con los que siembran las migraciones, y la grilla respeta el orden `sort` de la base", () => {
    expect(seeded("genres")).toEqual([...GENRE_IDS]);
  });
});

describe("países", () => {
  it("reconoce códigos ISO reales y rechaza el resto", () => {
    expect(isCountryCode("AR")).toBe(true);
    expect(isCountryCode("UY")).toBe(true);
    expect(isCountryCode("ES")).toBe(true);
    expect(isCountryCode("ar")).toBe(false);
    expect(isCountryCode("ZZ")).toBe(false);
    expect(isCountryCode("ARG")).toBe(false);
    expect(isCountryCode("")).toBe(false);
  });
  it("tiene los 249 países ISO y Intl conoce un nombre real para cada uno", () => {
    const es = countryOptions("es");
    expect(es).toHaveLength(249);
    // Si Intl no conociera un código, devolvería el código mismo como nombre.
    expect(es.filter((c) => c.name === c.code)).toEqual([]);
  });
  it("arma la lista en el idioma pedido y ordenada", () => {
    const es = countryOptions("es");
    expect(es.find((c) => c.code === "AR")?.name).toBe("Argentina");
    expect(es.find((c) => c.code === "DE")?.name).toBe("Alemania");
    const names = es.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b, "es"))).toEqual(names);
    expect(countryOptions("en").find((c) => c.code === "DE")?.name).toBe("Germany");
  });
});
