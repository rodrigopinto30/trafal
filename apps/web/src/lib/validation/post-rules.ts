/** Constants and types of updates that the interface also needs (kept apart from the schemas so the browser does not load Zod for them). */
export const POST_KINDS = ["avance", "nuevo_juego", "pide_feedback", "hito"] as const;
export type PostKindValue = (typeof POST_KINDS)[number];

export const POST_BODY_MAX = 2000;
export const POST_HIGHLIGHT_MAX = 12;

/** Error keys of the «publish an update» form (namespace «postForm.errors»). */
export const POST_ERROR_KEYS = [
  "invalidKind",
  "bodyRequired",
  "bodyTooLong",
  "highlightTooLong",
  "highlightNotAllowed",
  "gameRequired",
  "invalidGame",
  "tooManyFiles",
  "fileInvalid",
  "fileTooLarge",
  "fileAnimated",
  "fileDimensions",
  "fileTypeMismatch",
  "altTooLong",
  "invalidMedia",
  "requestTooLarge",
  "accountRestricted",
  "rateLimited",
  "unauthenticated",
  "notFound",
  "storage",
  "generic",
] as const;
export type PostErrorKey = (typeof POST_ERROR_KEYS)[number];
