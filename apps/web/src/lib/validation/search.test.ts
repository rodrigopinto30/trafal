import { describe, expect, it } from "vitest";
import { SEARCH_QUERY_MAX, parseSearchQuery, parseSuggestionQuery } from "./search";

describe("parseSearchQuery", () => {
  it("devuelve el texto saneado", () => {
    expect(parseSearchQuery("  gato   láser  ")).toBe("gato láser");
  });

  it("saca saltos de línea, caracteres de control e invisibles", () => {
    const hostile = ["ga", "\n", "\t", "to", String.fromCharCode(0), " ", String.fromCharCode(0x202e), "laser"].join("");
    expect(parseSearchQuery(hostile)).toBe("ga to laser");
  });

  it("rechaza lo vacío y lo que no es texto", () => {
    for (const value of ["", "   ", "\n\t", null, undefined, 42, {}, ["a"]]) expect(parseSearchQuery(value)).toBeNull();
  });

  it("recorta a 80 caracteres sin partir un emoji", () => {
    const result = parseSearchQuery("🎮".repeat(200));
    expect(Array.from(result ?? "")).toHaveLength(SEARCH_QUERY_MAX);
    expect(result).toBe("🎮".repeat(SEARCH_QUERY_MAX));
  });

  it("no interpreta nada: el texto pasa tal cual", () => {
    expect(parseSearchQuery(`<img src=x onerror=alert(1)> ' & | !`)).toBe(`<img src=x onerror=alert(1)> ' & | !`);
  });
});

describe("parseSuggestionQuery", () => {
  it("pide al menos 2 caracteres", () => {
    expect(parseSuggestionQuery("a")).toBeNull();
    expect(parseSuggestionQuery(" a ")).toBeNull();
    expect(parseSuggestionQuery("ab")).toBe("ab");
  });
});
