/** Constants and types of comments that the interface also needs (kept apart from the schemas so the browser does not load Zod for them). */
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
  "alreadyAnswered",
  "notOwner",
  "helpfulNotAllowed",
  "notFound",
  "accountRestricted",
  "unauthenticated",
  "generic",
] as const;
export type CommentErrorKey = (typeof COMMENT_ERROR_KEYS)[number];
