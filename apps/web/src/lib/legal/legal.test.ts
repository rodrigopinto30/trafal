import { describe, expect, it } from "vitest";
import { MIN_AGE } from "@/lib/auth/terms";
import { LEGAL_CONTENT, getLegalDocument } from "./documents";
import { fillLegalTokens, readLegalOperator } from "./operator";
import { LEGAL_DOCUMENT_IDS, LEGAL_TOKENS, type LegalBlock, type LegalDocumentContent } from "./types";

const shape = (block: LegalBlock) => (typeof block === "string" ? "p" : `ul${block.length}`);
const texts = (document: LegalDocumentContent) => [document.title, document.summary, ...document.sections.flatMap((section) => [section.title, ...section.blocks.flat()])];
const GAPS = { operator: "ACME", email: "hi@acme.test", jurisdiction: "Narnia" };

describe("the legal documents", () => {
  it("exist in both languages with the same sections, in the same order and with the same shape", () => {
    for (const id of LEGAL_DOCUMENT_IDS) {
      const es = LEGAL_CONTENT.es[id];
      const en = LEGAL_CONTENT.en[id];
      expect(en.sections.map((section) => section.id), id).toEqual(es.sections.map((section) => section.id));
      expect(en.sections.map((section) => section.blocks.map(shape)), id).toEqual(es.sections.map((section) => section.blocks.map(shape)));
    }
  });

  it("have unique section ids, usable as anchors, and no empty text", () => {
    for (const locale of ["es", "en"] as const) {
      for (const id of LEGAL_DOCUMENT_IDS) {
        const document = LEGAL_CONTENT[locale][id];
        const ids = document.sections.map((section) => section.id);
        expect(new Set(ids).size, `${locale}/${id}`).toBe(ids.length);
        for (const sectionId of ids) expect(sectionId).toMatch(/^[a-z][a-z0-9-]*$/);
        for (const text of texts(document)) expect(text.trim(), `${locale}/${id}`).not.toBe("");
      }
    }
  });

  it("only ask for the details the site can fill in", () => {
    for (const locale of ["es", "en"] as const) {
      for (const id of LEGAL_DOCUMENT_IDS) {
        for (const text of texts(LEGAL_CONTENT[locale][id])) {
          for (const [, token] of text.matchAll(/\{(\w+)\}/g)) expect(LEGAL_TOKENS as readonly string[], `${locale}/${id}: {${token}}`).toContain(token);
        }
      }
    }
  });

  it("name who runs the site and how to reach them where it matters", () => {
    for (const locale of ["es", "en"] as const) {
      const joined = (id: (typeof LEGAL_DOCUMENT_IDS)[number]) => texts(LEGAL_CONTENT[locale][id]).join("\n");
      expect(joined("terms")).toContain("{operator}");
      expect(joined("terms")).toContain("{email}");
      expect(joined("terms")).toContain("{jurisdiction}");
      expect(joined("privacy")).toContain("{operator}");
      expect(joined("privacy")).toContain("{email}");
      expect(joined("terms")).toContain("{minAge}");
    }
  });

  it("are written with voseo in Spanish", () => {
    const tuteo = /\b(puedes|tienes|debes|eres|quieres|piensas|haces|sabes|necesitas|escríbenos|contáctanos)\b/i;
    for (const id of LEGAL_DOCUMENT_IDS) {
      for (const text of texts(LEGAL_CONTENT.es[id])) expect(text, text).not.toMatch(tuteo);
    }
  });

  it("come out with every detail filled in", () => {
    for (const locale of ["es", "en"] as const) {
      for (const id of LEGAL_DOCUMENT_IDS) {
        const { document } = getLegalDocument(id, locale, { ...GAPS, complete: true });
        for (const text of texts(document)) expect(text).not.toMatch(/\{\w+\}/);
      }
    }
    const filled = getLegalDocument("terms", "en", { ...GAPS, complete: true }).document;
    expect(texts(filled).join("\n")).toContain(`${MIN_AGE} or older`);
    expect(texts(filled).join("\n")).toContain("Narnia");
  });
});

describe("the operator's details", () => {
  const set = { legalOperatorName: " ACME ", legalContactEmail: "hi@acme.test", legalJurisdiction: "Narnia" };

  it("are used as given, trimmed, when all are set", () => {
    expect(readLegalOperator("es", set)).toEqual({ operator: "ACME", email: "hi@acme.test", jurisdiction: "Narnia", complete: true });
  });

  it("show a visible gap, never an invented value, for what is missing", () => {
    const missing = readLegalOperator("es", { ...set, legalContactEmail: "  " });
    expect(missing.complete).toBe(false);
    expect(missing.email).toContain("a completar");
    expect(readLegalOperator("en", { legalOperatorName: "", legalContactEmail: "", legalJurisdiction: "" }).operator).toContain("to be filled in");
  });

  it("fill only the tokens that exist", () => {
    expect(fillLegalTokens("{operator} y {nada}", { operator: "A", email: "", jurisdiction: "", minAge: "18" })).toBe("A y {nada}");
  });
});
