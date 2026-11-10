import { getLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo/metadata";
import { LEGAL_CONTENT } from "./documents";
import type { LegalDocumentId } from "./types";

/** Title and description of a legal page, from the document itself. */
export async function legalMetadata(id: LegalDocumentId, path: string) {
  const locale = await getLocale();
  const { title, summary } = LEGAL_CONTENT[locale][id];
  return pageMetadata({ title, description: summary, path, locale });
}
