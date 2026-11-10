/** Constants and types of copyright claims that the interface also needs (kept apart from the schema so the browser does not load Zod for it). */
export const CLAIM_NAME_MAX = 120;
export const CLAIM_EMAIL_MAX = 200;
export const CLAIM_ORG_MAX = 120;
export const CLAIM_DESCRIPTION_MIN = 10;
export const CLAIM_DESCRIPTION_MAX = 2000;
export const CLAIM_URL_MAX = 500;
export const CLAIM_URLS_MAX = 10;
export const CLAIM_SIGNATURE_MAX = 120;

/** Error keys of the claim form (namespace «claims.errors»). */
export const CLAIM_ERROR_KEYS = [
  "nameRequired",
  "nameTooLong",
  "emailInvalid",
  "orgTooLong",
  "descriptionTooShort",
  "descriptionTooLong",
  "originalUrlInvalid",
  "urlsRequired",
  "urlsTooMany",
  "urlInvalid",
  "urlsNotOnSite",
  "statementsRequired",
  "signatureRequired",
  "tooManyClaims",
  "captchaFailed",
  "captchaUnavailable",
  "generic",
] as const;
export type ClaimErrorKey = (typeof CLAIM_ERROR_KEYS)[number];
