import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { altTextSchema, editPostSchema, newPostSchema, POST_BODY_MAX, POST_ERROR_KEYS, POST_HIGHLIGHT_MAX, postIdSchema } from "./post";

const GAME = "11111111-1111-4111-8111-111111111101";
const messageOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message;

describe("newPostSchema", () => {
  it("accepts an update, trims and cleans the text, and turns empty optionals into null", () => {
    const parsed = newPostSchema.parse({ kind: "avance", body: "  Hola\u200B mundo \n\n\n\nchau  " });
    expect(parsed).toEqual({ kind: "avance", body: "Hola mundo\n\nchau", highlight: null, gameId: null });
  });

  it("keeps emoji whole and counts them as one character each", () => {
    expect(newPostSchema.safeParse({ kind: "avance", body: "🎮".repeat(POST_BODY_MAX) }).success).toBe(true);
    expect(messageOf(newPostSchema.safeParse({ kind: "avance", body: "🎮".repeat(POST_BODY_MAX + 1) }))).toBe("bodyTooLong");
  });

  it("needs text and a known kind", () => {
    expect(messageOf(newPostSchema.safeParse({ kind: "avance", body: "   \n " }))).toBe("bodyRequired");
    expect(messageOf(newPostSchema.safeParse({ kind: "avance" }))).toBe("bodyRequired");
    expect(messageOf(newPostSchema.safeParse({ kind: "anuncio", body: "x" }))).toBe("invalidKind");
    expect(messageOf(newPostSchema.safeParse({ body: "x" }))).toBe("invalidKind");
  });

  it("asks for the game of a launch, and only accepts a real id", () => {
    expect(messageOf(newPostSchema.safeParse({ kind: "nuevo_juego", body: "x" }))).toBe("gameRequired");
    expect(newPostSchema.safeParse({ kind: "nuevo_juego", body: "x", gameId: GAME }).success).toBe(true);
    expect(messageOf(newPostSchema.safeParse({ kind: "avance", body: "x", gameId: "not-a-uuid" }))).toBe("invalidGame");
    expect(messageOf(newPostSchema.safeParse({ kind: "avance", body: "x", gameId: "1; drop table games" }))).toBe("invalidGame");
  });

  it("keeps the highlight for milestones only, up to its limit", () => {
    expect(newPostSchema.parse({ kind: "hito", body: "x", highlight: " 100 " }).highlight).toBe("100");
    expect(messageOf(newPostSchema.safeParse({ kind: "avance", body: "x", highlight: "100" }))).toBe("highlightNotAllowed");
    expect(messageOf(newPostSchema.safeParse({ kind: "hito", body: "x", highlight: "1".repeat(POST_HIGHLIGHT_MAX + 1) }))).toBe("highlightTooLong");
  });

  it.each([[null], ["text"], [42], [[]]])("rejects %j as a whole", (input) => {
    expect(newPostSchema.safeParse(input).success).toBe(false);
  });
});

describe("editPostSchema, altTextSchema and postIdSchema", () => {
  it("edits need an id and text", () => {
    expect(editPostSchema.parse({ id: GAME, body: " nuevo " })).toEqual({ id: GAME, body: "nuevo", highlight: "" });
    expect(messageOf(editPostSchema.safeParse({ id: "x", body: "y" }))).toBe("notFound");
    expect(messageOf(editPostSchema.safeParse({ id: GAME, body: "" }))).toBe("bodyRequired");
  });

  it("a description is one clean line of at most 200 characters", () => {
    expect(altTextSchema.parse("  Un\n nivel \u202E  ")).toBe("Un nivel");
    expect(altTextSchema.safeParse("a".repeat(201)).success).toBe(false);
  });

  it("only real ids are accepted", () => {
    expect(postIdSchema.safeParse(GAME).success).toBe(true);
    expect(postIdSchema.safeParse("1 or 1=1").success).toBe(false);
  });
});

describe.each([
  ["es", es.postForm],
  ["en", en.postForm],
])("post form messages (%s)", (_language, messages) => {
  it("has a message for every error key, and none left over", () => {
    expect(Object.keys(messages.errors).sort()).toEqual([...POST_ERROR_KEYS].sort());
  });

  it("every message is a non-empty sentence that ends in a full stop", () => {
    for (const message of Object.values(messages.errors)) expect(message).toMatch(/\S.*\.$/);
  });

  it("explains each kind of post", () => {
    expect(Object.keys(messages.kindHints).sort()).toEqual(Object.keys(messages.kinds).sort());
  });
});
