import { z } from "zod";
import { charLength, sanitizeMultiline, sanitizeLine } from "./text";
import {
  ACCOUNT_FILTERS,
  ACCOUNT_SEARCH_MAX,
  FEATURED_QUOTE_MAX,
  MODERATION_ACTIONS,
  MODERATION_NOTE_MAX,
  MODERATION_TARGETS,
  REPORT_OUTCOMES,
  REPORT_STATUS_FILTERS,
  SUSPENSION_DURATIONS,
  SUSPENSION_REASON_MAX,
  type AccountFilter,
  type ReportStatusFilter,
} from "./admin-rules";

export * from "./admin-rules";

const note = z
  .string()
  .transform(sanitizeMultiline)
  .refine((value) => charLength(value) <= MODERATION_NOTE_MAX, "noteTooLong");

export const takeReportSchema = z.object({ reportId: z.uuid("invalidInput") });
export const takeClaimSchema = z.object({ claimId: z.uuid("invalidInput") });

export const resolveReportSchema = z.object({
  reportId: z.uuid("invalidInput"),
  outcome: z.enum(REPORT_OUTCOMES, "invalidInput"),
  note: note.optional().default(""),
});

export const resolveClaimSchema = z.object({
  claimId: z.uuid("invalidInput"),
  outcome: z.enum(REPORT_OUTCOMES, "invalidInput"),
  note: note.optional().default(""),
});

export const moderateContentSchema = z.object({
  targetType: z.enum(MODERATION_TARGETS, "invalidInput"),
  targetId: z.uuid("invalidInput"),
  action: z.enum(MODERATION_ACTIONS, "invalidInput"),
  reason: note,
});

const week = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalidInput")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "invalidInput")
  .or(z.literal(""))
  .transform((value) => (value === "" ? null : value));

export const setFeaturedSchema = z.object({
  gameId: z.uuid("invalidInput"),
  week: week.optional().default(null),
  quote: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => charLength(value) <= FEATURED_QUOTE_MAX, "quoteTooLong")
    .optional()
    .default(""),
});

export const clearFeaturedSchema = z.object({ week: week.optional().default(null) });

/** The filter of the reports queue from the address: anything else is «open». */
export function parseReportStatusFilter(value: unknown): ReportStatusFilter {
  return REPORT_STATUS_FILTERS.find((candidate) => candidate === value) ?? "open";
}

export { parseBefore } from "./common";

const suspensionReason = z
  .string()
  .transform(sanitizeMultiline)
  .refine((value) => value !== "", "reasonRequired")
  .refine((value) => charLength(value) <= SUSPENSION_REASON_MAX, "reasonTooLong");

export const suspendAccountSchema = z.object({
  userId: z.uuid("invalidInput"),
  reason: suspensionReason,
  duration: z.enum(SUSPENSION_DURATIONS, "invalidInput"),
});

export const liftSuspensionSchema = z.object({ userId: z.uuid("invalidInput"), reason: suspensionReason });

const ACCOUNT_SEARCH_ALLOWED = /[^\p{L}\p{N}_ ]/gu;

/** The text of the accounts search from the address: letters, numbers, «_» and spaces only (it goes into a pattern), cleaned and short. */
export function parseAccountSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return sanitizeLine(value).replace(ACCOUNT_SEARCH_ALLOWED, "").trim().slice(0, ACCOUNT_SEARCH_MAX);
}

/** The filter of the accounts list from the address: anything else is «all». */
export function parseAccountFilter(value: unknown): AccountFilter {
  return ACCOUNT_FILTERS.find((candidate) => candidate === value) ?? "all";
}
