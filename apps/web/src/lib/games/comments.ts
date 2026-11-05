import type { CommentSummary } from "./types";

export type CommentThread = {
  comment: CommentSummary;
  replies: CommentSummary[];
};

const byOldest = (a: CommentSummary, b: CommentSummary) => Date.parse(a.created_at) - Date.parse(b.created_at);
const byNewest = (a: CommentSummary, b: CommentSummary) => byOldest(b, a);

/** Agrupa las respuestas bajo su comentario: los comentarios del más nuevo al más viejo y las respuestas en orden de conversación. */
export function groupComments(comments: CommentSummary[]): CommentThread[] {
  const topLevel = comments.filter((comment) => comment.parent_id === null).sort(byNewest);
  return topLevel.map((comment) => ({
    comment,
    replies: comments.filter((reply) => reply.parent_id === comment.id).sort(byOldest),
  }));
}
