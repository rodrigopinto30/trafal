import type { Locale } from "@/i18n/config";
import { legalEn } from "./content/en";
import { legalEs } from "./content/es";
import { fillLegalDocument, readLegalOperator, type LegalOperator } from "./operator";
import type { LegalContent, LegalDocumentContent, LegalDocumentId } from "./types";

export const LEGAL_CONTENT: Record<Locale, LegalContent> = { es: legalEs, en: legalEn };

/** A legal document in the language, with the operator's details filled in. */
export function getLegalDocument(id: LegalDocumentId, locale: Locale, operator: LegalOperator = readLegalOperator(locale)): { document: LegalDocumentContent; operator: LegalOperator } {
  return { document: fillLegalDocument(LEGAL_CONTENT[locale][id], operator), operator };
}
