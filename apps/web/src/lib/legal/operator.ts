import type { Locale } from "@/i18n/config";
import { MIN_AGE } from "@/lib/auth/terms";
import { publicEnv } from "@/lib/env";
import type { LegalBlock, LegalDocumentContent, LegalToken } from "./types";

export type LegalOperator = { operator: string; email: string; jurisdiction: string; complete: boolean };

const MISSING: Record<Locale, Record<Exclude<LegalToken, "minAge">, string>> = {
  es: { operator: "[titular del sitio: a completar]", email: "[email de contacto: a completar]", jurisdiction: "[jurisdicción: a completar]" },
  en: { operator: "[site operator: to be filled in]", email: "[contact email: to be filled in]", jurisdiction: "[jurisdiction: to be filled in]" },
};

type OperatorSettings = { legalOperatorName: string; legalContactEmail: string; legalJurisdiction: string };

/** Who runs the site, from LEGAL_OPERATOR_NAME, LEGAL_CONTACT_EMAIL and LEGAL_JURISDICTION. What is missing shows as a visible gap, never an invented value. */
export function readLegalOperator(locale: Locale, settings: OperatorSettings = publicEnv): LegalOperator {
  const name = settings.legalOperatorName.trim();
  const email = settings.legalContactEmail.trim();
  const jurisdiction = settings.legalJurisdiction.trim();
  return {
    operator: name || MISSING[locale].operator,
    email: email || MISSING[locale].email,
    jurisdiction: jurisdiction || MISSING[locale].jurisdiction,
    complete: name !== "" && email !== "" && jurisdiction !== "",
  };
}

/** Fills the {tokens} of a text. A token that does not exist is left as written (a test keeps the texts from having any). */
export function fillLegalTokens(text: string, values: Record<LegalToken, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key as LegalToken] : whole));
}

/** A document with its {tokens} replaced everywhere. */
export function fillLegalDocument(document: LegalDocumentContent, operator: LegalOperator): LegalDocumentContent {
  const values: Record<LegalToken, string> = { operator: operator.operator, email: operator.email, jurisdiction: operator.jurisdiction, minAge: String(MIN_AGE) };
  const fill = (block: LegalBlock): LegalBlock => (typeof block === "string" ? fillLegalTokens(block, values) : block.map((item) => fillLegalTokens(item, values)));
  return {
    title: fillLegalTokens(document.title, values),
    summary: fillLegalTokens(document.summary, values),
    sections: document.sections.map((section) => ({ id: section.id, title: fillLegalTokens(section.title, values), blocks: section.blocks.map(fill) })),
  };
}
