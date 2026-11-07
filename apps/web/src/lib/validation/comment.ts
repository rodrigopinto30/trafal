import { z } from "zod";
import { charLength, sanitizeMultiline } from "./text";

export const COMMENT_BODY_MAX = 1000;
export const COMMENT_LABELS = ["liked", "suggestion"] as const;
export const COMMENT_TARGETS = ["game", "post"] as const;
export type CommentLabelValue = (typeof COMMENT_LABELS)[number];
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

/** Error keys of the comment forms (namespace «comments.errors»). */
export const COMMENT_ERROR_KEYS = [
  "bodyRequired",
  "bodyTooLong",
  "invalidLabel",
  "replyNotAllowed",
  "parentNotFound",
  "notFound",
  "accountRestricted",
  "unauthenticated",
  "generic",
] as const;
export type CommentErrorKey = (typeof COMMENT_ERROR_KEYS)[number];

const body = z
  .string("bodyRequired")
  .transform(sanitizeMultiline)
  .refine((value) => charLength(value) >= 1, "bodyRequired")
  .refine((value) => charLength(value) <= COMMENT_BODY_MAX, "bodyTooLong");

const label = z
  .union([z.enum(COMMENT_LABELS), z.literal(""), z.null()], "invalidLabel")
  .optional()
  .transform((value) => value || null);

/** A new comment on a game or an update, or a reply to a comment (a reply carries no label). */
export const newCommentSchema = z
  .object({
    target: z.enum(COMMENT_TARGETS, "notFound"),
    id: z.uuid("notFound"),
    parentId: z.uuid("parentNotFound").nullish().transform((value) => value ?? null),
    label,
    body,
  })
  .superRefine((value, context) => {
    if (value.parentId !== null && value.label !== null) context.addIssue({ code: "custom", message: "replyNotAllowed", path: ["label"] });
  });

/** Editing a comment: its text and its label (the target and the author never change). */
export const editCommentSchema = z.object({
  id: z.uuid("notFound"),
  label,
  body,
});

export const commentIdSchema = z.uuid("notFound");
