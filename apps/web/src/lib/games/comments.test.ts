import { describe, expect, it } from "vitest";
import { groupComments } from "./comments";
import type { CommentSummary } from "./types";

function comment(id: string, createdAt: string, parentId: string | null = null): CommentSummary {
  return {
    id,
    question_id: null,
    author_id: "author",
    updated_at: createdAt,
    parent_id: parentId,
    body: id,
    label: null,
    is_helpful: false,
    created_at: createdAt,
    author: { username: "a", display_name: "A", avatar_path: null },
  };
}

describe("groupComments", () => {
  it("ordena los comentarios del más nuevo al más viejo", () => {
    const threads = groupComments([comment("viejo", "2026-11-01T00:00:00Z"), comment("nuevo", "2026-11-03T00:00:00Z")]);
    expect(threads.map((thread) => thread.comment.id)).toEqual(["nuevo", "viejo"]);
  });

  it("pone cada respuesta bajo su comentario, en orden de conversación", () => {
    const threads = groupComments([
      comment("raiz", "2026-11-01T00:00:00Z"),
      comment("segunda", "2026-11-03T00:00:00Z", "raiz"),
      comment("primera", "2026-11-02T00:00:00Z", "raiz"),
      comment("otra-raiz", "2026-11-04T00:00:00Z"),
    ]);
    expect(threads.map((thread) => thread.comment.id)).toEqual(["otra-raiz", "raiz"]);
    expect(threads[1]?.replies.map((reply) => reply.id)).toEqual(["primera", "segunda"]);
    expect(threads[0]?.replies).toEqual([]);
  });

  it("ignora respuestas cuyo comentario no está", () => {
    expect(groupComments([comment("huérfana", "2026-11-01T00:00:00Z", "no-existe")])).toEqual([]);
  });
});
