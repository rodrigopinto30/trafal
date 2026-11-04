import { describe, expect, it } from "vitest";
import { isInternalPath, localizePath, stripLocale } from "./path";

describe("stripLocale", () => {
  it("detecta y quita el prefijo de idioma", () => {
    expect(stripLocale("/en/login")).toEqual({ locale: "en", path: "/login" });
    expect(stripLocale("/es/u/valen")).toEqual({ locale: "es", path: "/u/valen" });
    expect(stripLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(stripLocale("/login")).toEqual({ locale: null, path: "/login" });
    expect(stripLocale("/")).toEqual({ locale: null, path: "/" });
  });
  it("no confunde rutas que solo empiezan parecido", () => {
    expect(stripLocale("/english")).toEqual({ locale: null, path: "/english" });
    expect(stripLocale("/espacio/x")).toEqual({ locale: null, path: "/espacio/x" });
  });
});

describe("localizePath", () => {
  it("el español va sin prefijo", () => {
    expect(localizePath("es", "/login")).toBe("/login");
    expect(localizePath("es", "/")).toBe("/");
  });
  it("el inglés lleva /en", () => {
    expect(localizePath("en", "/login")).toBe("/en/login");
    expect(localizePath("en", "/")).toBe("/en");
  });
  it("explicit fuerza el prefijo también en español", () => {
    expect(localizePath("es", "/login", { explicit: true })).toBe("/es/login");
    expect(localizePath("es", "/", { explicit: true })).toBe("/es");
  });
  it("conserva query y hash", () => {
    expect(localizePath("en", "/login?next=%2Fu%2Fana#top")).toBe("/en/login?next=%2Fu%2Fana#top");
  });
  it("reemplaza el idioma que ya traía la ruta", () => {
    expect(localizePath("es", "/en/login")).toBe("/login");
    expect(localizePath("en", "/es/login")).toBe("/en/login");
  });
});

describe("isInternalPath (anti redirección abierta)", () => {
  it("acepta rutas internas", () => {
    expect(isInternalPath("/")).toBe(true);
    expect(isInternalPath("/u/ana")).toBe(true);
    expect(isInternalPath("/login?next=/x")).toBe(true);
  });
  it.each([
    ["//evil.com"],
    ["/\\evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
    ["evil.com"],
    ["/ok\r\nSet-Cookie: x=1"],
    ["/ok\u0000"],
    [""],
    [null],
    [undefined],
  ])("rechaza %j", (value) => {
    expect(isInternalPath(value as string | null | undefined)).toBe(false);
  });
});
