import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { parseSurpriseParams, surpriseHref } from "./surprise";

describe("parseSurpriseParams", () => {
  it("takes a known language and a well-formed game id", () => {
    expect(parseSurpriseParams({ lang: "en", exclude: "orbita" })).toEqual({ locale: "en", exclude: "orbita" });
  });

  it.each([
    [{}],
    [{ lang: null, exclude: null }],
    [{ lang: "fr", exclude: "NOT VALID" }],
    [{ lang: "<script>", exclude: "../../etc/passwd" }],
    [{ lang: "en", exclude: "'; drop table games; --" }],
    [{ lang: "en", exclude: "a".repeat(200) }],
  ])("falls back to the default language and no exclusion for %j", (raw) => {
    const result = parseSurpriseParams(raw);
    expect(result.exclude).toBeNull();
    expect(["es", "en"]).toContain(result.locale);
  });
});

describe("surpriseHref", () => {
  it("builds a short, safe address", () => {
    expect(surpriseHref("es")).toBe("/api/surprise?lang=es");
    expect(surpriseHref("en", "orbita")).toBe("/api/surprise?lang=en&exclude=orbita");
    expect(surpriseHref("es", "a b&c")).toBe("/api/surprise?lang=es&exclude=a+b%26c");
  });
});

describe.each([
  ["es", es.surprise],
  ["en", en.surprise],
])("surprise messages (%s)", (_language, messages) => {
  it("has a label and a description for the button", () => {
    expect(messages.label.length).toBeGreaterThan(0);
    expect(messages.hint.length).toBeGreaterThan(0);
  });
});
