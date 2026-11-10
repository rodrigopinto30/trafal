export const LEGAL_DOCUMENT_IDS = ["terms", "privacy", "guidelines", "copyright"] as const;
export type LegalDocumentId = (typeof LEGAL_DOCUMENT_IDS)[number];

/** A paragraph (a string) or a bullet list (an array of strings). */
export type LegalBlock = string | readonly string[];

export type LegalSection = { id: string; title: string; blocks: readonly LegalBlock[] };

export type LegalDocumentContent = { title: string; summary: string; sections: readonly LegalSection[] };

export type LegalContent = Record<LegalDocumentId, LegalDocumentContent>;

/** The words a text can ask the site to fill in: who runs it, how to reach them, which courts, the minimum age. */
export const LEGAL_TOKENS = ["operator", "email", "jurisdiction", "minAge"] as const;
export type LegalToken = (typeof LEGAL_TOKENS)[number];
