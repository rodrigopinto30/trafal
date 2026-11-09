import { z } from "zod";
import {
  CONTROLS_MAX,
  DESCRIPTION_MAX,
  DISPLAY_RATIOS,
  MAX_QUESTIONS,
  MAX_QUESTION_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MAX_ZIP_BYTES,
  MIN_QUESTION_LENGTH,
  TITLE_MAX,
  looksLikeZip,
} from "@/lib/games/upload-rules";
import { ENGINE_IDS, GENRE_IDS } from "@/lib/profile/catalog";
import { charLength, sanitizeLine, sanitizeMultiline, unique } from "./text";

/**
 * Schemas of the "upload a game" form. As everywhere else, the `message` of each rule is an i18n key (namespace
 * «gameForm.errors»), never display text.
 */
export const GAME_FORM_ERROR_KEYS = [
  "invalidTitle",
  "descriptionTooLong",
  "invalidGenre",
  "invalidEngine",
  "tooManyTags",
  "tagTooLong",
  "controlsTooLong",
  "invalidRatio",
  "tooManyQuestions",
  "questionLength",
  "zipRequired",
  "zipNotZip",
  "zipTooLarge",
  "coverInvalid",
  "coverTooLarge",
  "coverDimensions",
  "coverAnimated",
  "screenshotsInvalid",
  "tooManyScreenshots",
  "firstGameTaken",
  "dailyLimit",
  "accountRestricted",
  "unauthenticated",
  "storage",
  "generic",
] as const;
export type GameFormErrorKey = (typeof GAME_FORM_ERROR_KEYS)[number];

const catalogId = (allowed: readonly string[], key: GameFormErrorKey) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => allowed.includes(value), key);

const tagList = z
  .string()
  .transform((value) =>
    unique(
      value
        .split(",")
        .map((tag) => sanitizeLine(tag).toLowerCase())
        .filter((tag) => tag !== ""),
    ),
  )
  .superRefine((tags, ctx) => {
    if (tags.some((tag) => charLength(tag) > MAX_TAG_LENGTH)) ctx.addIssue({ code: "custom", message: "tagTooLong" });
    else if (tags.length > MAX_TAGS) ctx.addIssue({ code: "custom", message: "tooManyTags" });
  });

const questionList = z
  .array(z.string())
  .transform((questions) => questions.map(sanitizeLine).filter((question) => question !== ""))
  .superRefine((questions, ctx) => {
    if (questions.length > MAX_QUESTIONS) ctx.addIssue({ code: "custom", message: "tooManyQuestions" });
    else if (questions.some((question) => charLength(question) < MIN_QUESTION_LENGTH || charLength(question) > MAX_QUESTION_LENGTH)) {
      ctx.addIssue({ code: "custom", message: "questionLength" });
    }
  });

export const gameDetailsSchema = z.object({
  title: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => charLength(value) >= 1 && charLength(value) <= TITLE_MAX, "invalidTitle"),
  shortDescription: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => charLength(value) <= DESCRIPTION_MAX, "descriptionTooLong"),
  genre: catalogId(GENRE_IDS, "invalidGenre"),
  engine: catalogId(ENGINE_IDS, "invalidEngine"),
  tags: tagList,
  controls: z
    .string()
    .transform(sanitizeMultiline)
    .refine((value) => charLength(value) <= CONTROLS_MAX, "controlsTooLong"),
  displayRatio: z.enum(DISPLAY_RATIOS, "invalidRatio"),
  worksOnMobile: z.boolean(),
  isFirstGame: z.boolean(),
  questions: questionList,
});

export const zipDeclarationSchema = z.object({
  zipName: z
    .string()
    .transform(sanitizeLine)
    .refine((name) => name !== "" && looksLikeZip(name), "zipNotZip"),
  zipSize: z.coerce
    .number()
    .int()
    .min(1, "zipRequired")
    .max(MAX_ZIP_BYTES, "zipTooLarge"),
});

export const uuidSchema = z.uuid();

export const gameVisibilitySchema = z.object({ gameId: z.uuid(), status: z.enum(["draft", "published"]) });

import { VERSION_CHANGELOG_MAX, VERSION_LABEL_MAX } from "./game-rules";
export { VERSION_CHANGELOG_MAX, VERSION_LABEL_MAX } from "./game-rules";

/** Error keys of the version forms (namespace «gameVersions.errors»). */
export const VERSION_ERROR_KEYS = [
  "invalidLabel",
  "labelTooLong",
  "changelogTooLong",
  "zipRequired",
  "zipNotZip",
  "zipTooLarge",
  "dailyLimit",
  "gameNotFound",
  "versionNotFound",
  "versionNotReady",
  "accountRestricted",
  "unauthenticated",
  "storage",
  "generic",
] as const;
export type VersionErrorKey = (typeof VERSION_ERROR_KEYS)[number];

const changelogSchema = z
  .string()
  .transform(sanitizeMultiline)
  .refine((value) => charLength(value) <= VERSION_CHANGELOG_MAX, "changelogTooLong");

/** Details of a NEW version: the label is optional (the database names it v<number>). */
export const newVersionSchema = z.object({
  gameId: z.uuid("generic"),
  label: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => charLength(value) <= VERSION_LABEL_MAX, "labelTooLong"),
  changelog: changelogSchema,
});

/** Edit of an existing version: the label cannot be empty. */
export const editVersionSchema = z.object({
  versionId: z.uuid("generic"),
  label: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => charLength(value) >= 1 && charLength(value) <= VERSION_LABEL_MAX, "invalidLabel"),
  changelog: changelogSchema,
});
