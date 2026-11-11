/** Constants and types of appeals that the interface also needs (kept apart from the schemas so the browser does not load Zod for them). */
export const APPEAL_MESSAGE_MAX = 1000;

export const APPEAL_TARGETS = ["profile", "game", "post", "comment"] as const;
export type AppealTarget = (typeof APPEAL_TARGETS)[number];

export const APPEAL_OUTCOMES = ["upheld", "overturned"] as const;
export type AppealOutcome = (typeof APPEAL_OUTCOMES)[number];

export const COUNTER_NOTICE_TARGETS = ["game", "post"] as const;
export const COUNTER_NOTICE_NAME_MAX = 200;
export const COUNTER_NOTICE_EMAIL_MAX = 254;

export const APPEAL_FILTERS = ["open", "resolved"] as const;
export type AppealFilter = (typeof APPEAL_FILTERS)[number];

/** Error keys of the appeal dialog (namespace «appeals.errors»). */
export const APPEAL_ERROR_KEYS = [
  "messageRequired",
  "messageTooLong",
  "nameRequired",
  "invalidEmail",
  "statementsRequired",
  "nothingToAppeal",
  "alreadyAppealed",
  "counterNoticeRequired",
  "notAClaim",
  "tooManyOpen",
  "unauthenticated",
  "generic",
] as const;
export type AppealErrorKey = (typeof APPEAL_ERROR_KEYS)[number];
