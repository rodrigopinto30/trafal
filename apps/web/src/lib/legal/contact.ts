import { MIN_AGE } from "@/lib/auth/terms";
import { publicEnv } from "@/lib/env";
import type { LegalBlock, LegalDocumentContent, LegalToken } from "./types";

/** The contact email the documents name, from LEGAL_CONTACT_EMAIL. It is optional: the site has its own channels. */
export function readLegalContactEmail(settings: { legalContactEmail: string } = publicEnv): string | null {
  return settings.legalContactEmail.trim() || null;
}

/** Fills the {tokens} of a text. A token that does not exist is left as written (a test keeps the texts from having any). */
export function fillLegalTokens(text: string, values: Record<LegalToken, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key as LegalToken] : whole));
}

const NAMES_EMAIL = /\{email\}/;

/** A document with its {tokens} filled in. Without a contact email, every paragraph or list item that names it is left out. */
export function fillLegalDocument(document: LegalDocumentContent, email: string | null): LegalDocumentContent {
  const values: Record<LegalToken, string> = { email: email ?? "", minAge: String(MIN_AGE) };
  const shown = (text: string) => email !== null || !NAMES_EMAIL.test(text);
  const fill = (block: LegalBlock): LegalBlock | null => {
    if (typeof block === "string") return shown(block) ? fillLegalTokens(block, values) : null;
    const items = block.filter(shown).map((item) => fillLegalTokens(item, values));
    return items.length > 0 ? items : null;
  };
  return {
    title: fillLegalTokens(document.title, values),
    summary: fillLegalTokens(document.summary, values),
    sections: document.sections.map((section) => ({
      id: section.id,
      title: fillLegalTokens(section.title, values),
      blocks: section.blocks.map(fill).filter((block): block is LegalBlock => block !== null),
    })),
  };
}
