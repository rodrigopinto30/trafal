import { z } from "zod";
import { charLength, sanitizeMultiline } from "./text";

export const REPORT_REASONS = ["broken", "inappropriate", "spam", "abuse", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_DETAIL_MAX = 1000;

/** Error keys of the report form (namespace «gamePlayer.report.errors»). */
export const REPORT_ERROR_KEYS = ["invalidReason", "detailTooLong", "alreadyReported", "unauthenticated", "accountRestricted", "generic"] as const;
export type ReportErrorKey = (typeof REPORT_ERROR_KEYS)[number];

export const reportGameSchema = z.object({
  gameId: z.uuid("generic"),
  reason: z.enum(REPORT_REASONS, "invalidReason"),
  detail: z
    .string()
    .transform(sanitizeMultiline)
    .refine((value) => charLength(value) <= REPORT_DETAIL_MAX, "detailTooLong"),
});
