import { z } from "zod";
import { POST_MEDIA_MAX_ALT } from "@/lib/media/post-media";
import { charLength, sanitizeLine, sanitizeMultiline } from "./text";

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
  "unauthenticated",
  "notFound",
  "storage",
  "generic",
] as const;
export type PostErrorKey = (typeof POST_ERROR_KEYS)[number];

const body = z
  .string("bodyRequired")
  .transform(sanitizeMultiline)
  .refine((value) => charLength(value) >= 1, "bodyRequired")
  .refine((value) => charLength(value) <= POST_BODY_MAX, "bodyTooLong");

const highlight = z
  .string("generic")
  .transform(sanitizeLine)
  .refine((value) => charLength(value) <= POST_HIGHLIGHT_MAX, "highlightTooLong");

const optionalGameId = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value === "" || z.uuid().safeParse(value).success, "invalidGame")
  .transform((value) => (value === "" ? null : value));

/** The fields of a new update (the files are checked apart, byte by byte). A highlight only belongs to a milestone, and a launch needs its game. */
export const newPostSchema = z
  .object({
    kind: z.enum(POST_KINDS, "invalidKind"),
    body,
    highlight: highlight.optional().default(""),
    gameId: optionalGameId.optional().default(null),
  })
  .superRefine((value, context) => {
    if (value.kind === "nuevo_juego" && value.gameId === null) context.addIssue({ code: "custom", message: "gameRequired", path: ["gameId"] });
    if (value.kind !== "hito" && value.highlight !== "") context.addIssue({ code: "custom", message: "highlightNotAllowed", path: ["highlight"] });
  })
  .transform((value) => ({ ...value, highlight: value.highlight === "" ? null : value.highlight }));

export const altTextSchema = z
  .string()
  .transform(sanitizeLine)
  .refine((value) => charLength(value) <= POST_MEDIA_MAX_ALT, "altTooLong");

export const postIdSchema = z.uuid("notFound");
