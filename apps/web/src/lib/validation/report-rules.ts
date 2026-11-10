/** Constants and types of reports that the interface also needs (kept apart from the schema so the browser does not load Zod for it). */
export const REPORT_REASONS = ["broken", "inappropriate", "spam", "abuse", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGETS = ["game", "post", "comment", "profile"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

/** The reasons that make sense for each kind of content («It doesn't work» only applies to games). */
export const REPORT_REASONS_BY_TARGET: Record<ReportTarget, readonly ReportReason[]> = {
  game: ["broken", "inappropriate", "spam", "abuse", "copyright", "other"],
  post: ["inappropriate", "spam", "abuse", "copyright", "other"],
  comment: ["inappropriate", "spam", "abuse", "other"],
  profile: ["inappropriate", "spam", "abuse", "other"],
};

export const REPORT_DETAIL_MAX = 1000;

/** Error keys of the report form (namespace «report.errors»). */
export const REPORT_ERROR_KEYS = ["invalidReason", "detailTooLong", "alreadyReported", "targetNotFound", "unauthenticated", "accountRestricted", "rateLimited", "generic"] as const;
export type ReportErrorKey = (typeof REPORT_ERROR_KEYS)[number];
