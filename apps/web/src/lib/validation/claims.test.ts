import { describe, expect, it } from "vitest";
import { CLAIM_ERROR_KEYS, claimFormSchema, parseSiteTarget } from "./claims";

const valid = {
  claimantName: "Carla Owner",
  claimantEmail: "owner@example.com",
  claimantOrg: "",
  workDescription: "A sprite sheet I drew in 2024 and published on my site",
  originalUrl: "",
  urls: "https://trafal.example/games/orbita",
  statementGoodFaith: "on",
  statementAccuracy: "on",
  signature: "Carla Owner",
};

function messages(input: Record<string, unknown>): string[] {
  const result = claimFormSchema.safeParse({ ...valid, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("claimFormSchema", () => {
  it("accepts a complete claim and cleans it", () => {
    expect(messages({})).toEqual([]);
    const parsed = claimFormSchema.parse({ ...valid, claimantName: "  Carla   Owner ", urls: " https://a.example/x \n\n https://b.example/y \n" });
    expect(parsed.claimantName).toBe("Carla Owner");
    expect(parsed.urls).toEqual(["https://a.example/x", "https://b.example/y"]);
  });

  it("needs the name, a real email and the signature", () => {
    expect(messages({ claimantName: "  " })).toContain("nameRequired");
    expect(messages({ claimantEmail: "carla" })).toEqual(["emailInvalid"]);
    expect(messages({ claimantEmail: "a b@example.com" })).toEqual(["emailInvalid"]);
    expect(messages({ signature: " " })).toContain("signatureRequired");
  });

  it("limits the description to 10–2000 characters", () => {
    expect(messages({ workDescription: "corto" })).toEqual(["descriptionTooShort"]);
    expect(messages({ workDescription: "a".repeat(2000) })).toEqual([]);
    expect(messages({ workDescription: "a".repeat(2001) })).toEqual(["descriptionTooLong"]);
  });

  it("needs between 1 and 10 links, all of them http(s)", () => {
    expect(messages({ urls: "  \n " })).toEqual(["urlsRequired"]);
    expect(messages({ urls: Array.from({ length: 11 }, (_, n) => `https://a.example/${n}`).join("\n") })).toEqual(["urlsTooMany"]);
    expect(messages({ urls: "javascript:alert(1)" })).toEqual(["urlInvalid"]);
    expect(messages({ urls: "ftp://a.example/x" })).toEqual(["urlInvalid"]);
    expect(messages({ urls: "no es un enlace" })).toEqual(["urlInvalid"]);
    expect(messages({ urls: `https://a.example/${"x".repeat(500)}` })).toEqual(["urlInvalid"]);
  });

  it("takes the link to the original only if it is a link", () => {
    expect(messages({ originalUrl: "https://example.com/mi-obra" })).toEqual([]);
    expect(messages({ originalUrl: "example.com/mi-obra" })).toEqual(["originalUrlInvalid"]);
  });

  it("needs both statements ticked", () => {
    expect(messages({ statementGoodFaith: "" })).toEqual(["statementsRequired"]);
    expect(messages({ statementAccuracy: "" })).toEqual(["statementsRequired"]);
  });

  it("only uses error keys the form knows how to translate", () => {
    for (const message of [...messages({ claimantName: "", claimantEmail: "x", urls: "", statementGoodFaith: "", signature: "" }), ...messages({ workDescription: "a" })]) {
      expect(CLAIM_ERROR_KEYS as readonly string[]).toContain(message);
    }
  });
});

describe("parseSiteTarget", () => {
  const origin = "https://trafal.example";

  it("finds the game or the update a link of the site points at", () => {
    expect(parseSiteTarget("https://trafal.example/games/orbita", origin)).toEqual({ type: "game", publicId: "orbita" });
    expect(parseSiteTarget("https://trafal.example/en/games/kart-de-carton/manage", origin)).toEqual({ type: "game", publicId: "kart-de-carton" });
    expect(parseSiteTarget("https://trafal.example/posts/55555555-5555-4555-8555-555555555501#comments", origin)).toEqual({ type: "post", postId: "55555555-5555-4555-8555-555555555501" });
  });

  it("ignores anything that is not on the site or not a game or an update", () => {
    expect(parseSiteTarget("https://other.example/games/orbita", origin)).toBeNull();
    expect(parseSiteTarget("https://trafal.example.evil.example/games/orbita", origin)).toBeNull();
    expect(parseSiteTarget("https://trafal.example/u/valen_makes", origin)).toBeNull();
    expect(parseSiteTarget("https://trafal.example/posts/no-es-un-id", origin)).toBeNull();
    expect(parseSiteTarget("https://trafal.example/games/Orbita!", origin)).toBeNull();
    expect(parseSiteTarget("no es un enlace", origin)).toBeNull();
  });
});
