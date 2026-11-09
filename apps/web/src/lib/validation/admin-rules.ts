/** Constants and types of the admin screens that the interface also needs (kept apart from the schemas so the browser does not load Zod for them). */
export const MODERATION_NOTE_MAX = 1000;
export const FEATURED_QUOTE_MAX = 280;

export const REPORT_OUTCOMES = ["dismissed", "actioned", "hide_content"] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

export const MODERATION_ACTIONS = ["hide", "restore"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_TARGETS = ["game", "post", "comment"] as const;
export type ModerationTarget = (typeof MODERATION_TARGETS)[number];

export const REPORT_STATUS_FILTERS = ["open", "reviewing", "resolved"] as const;
export type ReportStatusFilter = (typeof REPORT_STATUS_FILTERS)[number];

/** Error keys of the admin screens (namespace «admin.errors»). */
export const ADMIN_ERROR_KEYS = [
  "notAdmin",
  "unauthenticated",
  "reportNotFound",
  "reportNotOpen",
  "reportAlreadyResolved",
  "reasonRequired",
  "noteTooLong",
  "targetNotFound",
  "invalidStatus",
  "cannotHideProfile",
  "weekNotMonday",
  "weekInThePast",
  "weekTooFar",
  "notEligible",
  "alreadyFeatured",
  "quoteTooLong",
  "invalidInput",
  "generic",
] as const;
export type AdminErrorKey = (typeof ADMIN_ERROR_KEYS)[number];
