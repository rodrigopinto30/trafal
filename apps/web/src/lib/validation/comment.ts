import { z } from "zod";
import { charLength, sanitizeMultiline } from "./text";

import { COMMENT_BODY_MAX, COMMENT_TARGETS } from "./comment-rules";
export { COMMENT_BODY_MAX, COMMENT_TARGETS, COMMENT_ERROR_KEYS } from "./comment-rules";
export type { CommentTarget, CommentErrorKey } from "./comment-rules";

const body = z
  .string("bodyRequired")
  .transform(sanitizeMultiline)
  .refine((value) => charLength(value) >= 1, "bodyRequired")
  .refine((value) => charLength(value) <= COMMENT_BODY_MAX, "bodyTooLong");

/** A new comment on a game or an update, a reply to a comment, or the answer to one of the creator's questions (an answer is a top-level comment on the game). */
export const newCommentSchema = z
  .object({
    target: z.enum(COMMENT_TARGETS, "notFound"),
    id: z.uuid("notFound"),
    parentId: z.uuid("parentNotFound").nullish().transform((value) => value ?? null),
    questionId: z.uuid("notFound").nullish().transform((value) => value ?? null),
    body,
  })
  .superRefine((value, context) => {
    if (value.questionId !== null && (value.target !== "game" || value.parentId !== null)) {
      context.addIssue({ code: "custom", message: "replyNotAllowed", path: ["questionId"] });
    }
  });

/** The creator marks (or unmarks) a comment as «Me sirvió». */
export const helpfulSchema = z.object({
  id: z.uuid("notFound"),
  helpful: z.boolean("generic"),
});

/** Editing a comment: only its text (the target and the author never change). */
export const editCommentSchema = z.object({
  id: z.uuid("notFound"),
  body,
});

export const commentIdSchema = z.uuid("notFound");
