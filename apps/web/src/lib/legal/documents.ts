import type { Locale } from "@/i18n/config";
import { fillLegalDocument, readLegalContactEmail } from "./contact";
import { legalEn } from "./content/en";
import { legalEs } from "./content/es";
import type { LegalContent, LegalDocumentContent, LegalDocumentId } from "./types";

export const LEGAL_CONTENT: Record<Locale, LegalContent> = { es: legalEs, en: legalEn };

/** A legal document in the language, with the minimum age and, when there is one, the contact email filled in. */
export function getLegalDocument(id: LegalDocumentId, locale: Locale, email: string | null = readLegalContactEmail()): LegalDocumentContent {
  return fillLegalDocument(LEGAL_CONTENT[locale][id], email);
}
