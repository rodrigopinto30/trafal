import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { COMMENT_BODY_MAX, COMMENT_ERROR_KEYS, commentIdSchema, editCommentSchema, newCommentSchema } from "./comment";

const ID = "11111111-1111-4111-8111-111111111101";
const OTHER = "22222222-2222-4222-8222-222222222202";
const messageOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message;

describe("newCommentSchema", () => {
  it("accepts a comment on a game or an update, cleans the text and turns empty optionals into null", () => {
    expect(newCommentSchema.parse({ target: "game", id: ID, body: "  Muy lindo\u200B juego \n\n\n\nsaludos  " })).toEqual({
      target: "game",
      id: ID,
      parentId: null,
      label: null,
      body: "Muy lindo juego\n\nsaludos",
    });
    expect(newCommentSchema.parse({ target: "post", id: ID, label: "suggestion", body: "x" }).label).toBe("suggestion");
    expect(newCommentSchema.parse({ target: "post", id: ID, label: "", body: "x" }).label).toBeNull();
  });

  it("needs text, up to the limit, counting emoji as one character each", () => {
    expect(messageOf(newCommentSchema.safeParse({ target: "game", id: ID, body: " \n " }))).toBe("bodyRequired");
    expect(messageOf(newCommentSchema.safeParse({ target: "game", id: ID }))).toBe("bodyRequired");
    expect(newCommentSchema.safeParse({ target: "game", id: ID, body: "🎮".repeat(COMMENT_BODY_MAX) }).success).toBe(true);
    expect(messageOf(newCommentSchema.safeParse({ target: "game", id: ID, body: "🎮".repeat(COMMENT_BODY_MAX + 1) }))).toBe("bodyTooLong");
  });

  it("only knows the two labels", () => {
    expect(messageOf(newCommentSchema.safeParse({ target: "game", id: ID, label: "meh", body: "x" }))).toBe("invalidLabel");
    expect(messageOf(newCommentSchema.safeParse({ target: "game", id: ID, label: "LIKED", body: "x" }))).toBe("invalidLabel");
  });

  it("a reply points to a comment and carries no label", () => {
    expect(newCommentSchema.parse({ target: "game", id: ID, parentId: OTHER, body: "gracias" }).parentId).toBe(OTHER);
    expect(messageOf(newCommentSchema.safeParse({ target: "game", id: ID, parentId: OTHER, label: "liked", body: "x" }))).toBe("replyNotAllowed");
    expect(messageOf(newCommentSchema.safeParse({ target: "game", id: ID, parentId: "nope", body: "x" }))).toBe("parentNotFound");
  });

  it("only real targets and ids", () => {
    expect(messageOf(newCommentSchema.safeParse({ target: "user", id: ID, body: "x" }))).toBe("notFound");
    expect(messageOf(newCommentSchema.safeParse({ target: "game", id: "1 or 1=1", body: "x" }))).toBe("notFound");
  });

  it.each([[null], ["text"], [42], [[]]])("rejects %j as a whole", (input) => {
    expect(newCommentSchema.safeParse(input).success).toBe(false);
  });
});

describe("editCommentSchema and commentIdSchema", () => {
  it("an edit needs an id and text; the label may go away", () => {
    expect(editCommentSchema.parse({ id: ID, body: " nuevo ", label: "liked" })).toEqual({ id: ID, body: "nuevo", label: "liked" });
    expect(editCommentSchema.parse({ id: ID, body: "x", label: "" }).label).toBeNull();
    expect(messageOf(editCommentSchema.safeParse({ id: "x", body: "y" }))).toBe("notFound");
    expect(messageOf(editCommentSchema.safeParse({ id: ID, body: "" }))).toBe("bodyRequired");
  });

  it("only real ids", () => {
    expect(commentIdSchema.safeParse(ID).success).toBe(true);
    expect(commentIdSchema.safeParse("1; drop table comments").success).toBe(false);
  });
});

describe.each([
  ["es", es.comments],
  ["en", en.comments],
])("comment messages (%s)", (_language, messages) => {
  it("has a message for every error key, and none left over", () => {
    expect(Object.keys(messages.errors).sort()).toEqual([...COMMENT_ERROR_KEYS].sort());
  });

  it("every error is a sentence that ends in a full stop", () => {
    for (const message of Object.values(messages.errors)) expect(message).toMatch(/\S.*\.$/);
  });
});
