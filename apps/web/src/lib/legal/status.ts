/**
 * Day the legal texts were last changed (ISO date). When a text changes in a way that people must accept again, also raise
 * TERMS_VERSION (lib/auth/terms.ts).
 */
export const LEGAL_UPDATED = "2026-11-10";

/**
 * While true, every legal document says it is a draft that a lawyer has not reviewed yet. Set it to false only when the texts
 * have been reviewed and the operator details are filled in.
 */
export const LEGAL_DRAFT = true;
