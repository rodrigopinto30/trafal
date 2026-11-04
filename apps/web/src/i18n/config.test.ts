import { describe, expect, it } from "vitest";
import { isLocale, negotiateLocale } from "./config";

describe("isLocale", () => {
  it("acepta solo los idiomas soportados", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale("ES")).toBe(false);
  });
});

describe("negotiateLocale", () => {
  it("usa el español por defecto", () => {
    expect(negotiateLocale(null)).toBe("es");
    expect(negotiateLocale("")).toBe("es");
    expect(negotiateLocale("fr-FR,fr;q=0.9")).toBe("es");
  });
  it("respeta la preferencia del navegador", () => {
    expect(negotiateLocale("en-US,en;q=0.9,es;q=0.8")).toBe("en");
    expect(negotiateLocale("es-AR,es;q=0.9,en;q=0.5")).toBe("es");
  });
  it("respeta las prioridades (q) aunque no vengan en orden", () => {
    expect(negotiateLocale("es;q=0.4,en;q=0.9")).toBe("en");
  });
  it("ignora idiomas no soportados antes de uno soportado", () => {
    expect(negotiateLocale("fr,de;q=0.9,en;q=0.8")).toBe("en");
  });
  it("ignora q=0 y valores corruptos", () => {
    expect(negotiateLocale("en;q=0,es;q=0.5")).toBe("es");
    expect(negotiateLocale("en;q=abc")).toBe("es");
  });
});
