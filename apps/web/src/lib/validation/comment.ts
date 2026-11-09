import { z } from "zod";
import { charLength, sanitizeMultiline } from "./text";

import { COMMENT_BODY_MAX, COMMENT_LABELS, COMMENT_TARGETS } from "./comment-rules";
export { COMMENT_BODY_MAX, COMMENT_LABELS, COMMENT_TARGETS, COMMENT_ERROR_KEYS } from "./comment-rules";
export type { CommentLabelValue, CommentTarget, CommentErrorKey } from "./comment-rules";

const body = z
  .string("bodyRequired")
  .transform(sanitizeMultiline)
  .refine((value) => charLength(value) >= 1, "bodyRequired")
  .refine((value) => charLength(value) <= COMMENT_BODY_MAX, "bodyTooLong");

const label = z
  .union([z.enum(COMMENT_LABELS), z.literal(""), z.null()], "invalidLabel")
  .optional()
  .transform((value) => value || null);

/** A new comment on a game or an update, a reply to a comment (a reply carries no label), or the answer to one of the creator's questions (an answer is a comment on the game without label). */
export const newCommentSchema = z
  .object({
    target: z.enum(COMMENT_TARGETS, "notFound"),
    id: z.uuid("notFound"),
    parentId: z.uuid("parentNotFound").nullish().transform((value) => value ?? null),
    questionId: z.uuid("notFound").nullish().transform((value) => value ?? null),
    label,
    body,
  })
  .superRefine((value, context) => {
    if (value.parentId !== null && value.label !== null) context.addIssue({ code: "custom", message: "replyNotAllowed", path: ["label"] });
    if (value.questionId !== null && (value.target !== "game" || value.parentId !== null || value.label !== null)) {
      context.addIssue({ code: "custom", message: "replyNotAllowed", path: ["questionId"] });
    }
  });

/** The creator marks (or unmarks) a comment as «Me sirvió». */
export const helpfulSchema = z.object({
  id: z.uuid("notFound"),
  helpful: z.boolean("generic"),
});

/** Editing a comment: its text and its label (the target and the author never change). */
export const editCommentSchema = z.object({
  id: z.uuid("notFound"),
  label,
  body,
});

export const commentIdSchema = z.uuid("notFound");
