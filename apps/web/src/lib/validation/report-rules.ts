/** Constants and types of reports that the interface also needs (kept apart from the schema so the browser does not load Zod for it). */
export const REPORT_REASONS = ["broken", "inappropriate", "spam", "abuse", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_DETAIL_MAX = 1000;

/** Error keys of the report form (namespace «gamePlayer.report.errors»). */
export const REPORT_ERROR_KEYS = ["invalidReason", "detailTooLong", "alreadyReported", "unauthenticated", "accountRestricted", "generic"] as const;
export type ReportErrorKey = (typeof REPORT_ERROR_KEYS)[number];
