import { describe, expect, it } from "vitest";
import { MIN_AGE } from "@/lib/auth/terms";
import { LEGAL_CONTENT, getLegalDocument } from "./documents";
import { fillLegalTokens, readLegalContactEmail } from "./contact";
import { LEGAL_DOCUMENT_IDS, LEGAL_TOKENS, type LegalBlock, type LegalDocumentContent } from "./types";

const shape = (block: LegalBlock) => (typeof block === "string" ? "p" : `ul${block.length}`);
const texts = (document: LegalDocumentContent) => [document.title, document.summary, ...document.sections.flatMap((section) => [section.title, ...section.blocks.flat()])];

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
        expect(ids, "the page's main content already uses this id (skip link)").not.toContain("contenido");
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

  it("offer a contact email where it matters, and name the minimum age", () => {
    for (const locale of ["es", "en"] as const) {
      const joined = (id: (typeof LEGAL_DOCUMENT_IDS)[number]) => texts(LEGAL_CONTENT[locale][id]).join("\n");
      expect(joined("terms")).toContain("{email}");
      expect(joined("privacy")).toContain("{email}");
      expect(joined("terms")).toContain("{minAge}");
    }
  });

  it("do not name an operator or a jurisdiction", () => {
    for (const locale of ["es", "en"] as const) {
      for (const id of LEGAL_DOCUMENT_IDS) {
        for (const text of texts(LEGAL_CONTENT[locale][id])) expect(text).not.toMatch(/\{(operator|jurisdiction)\}|a completar|to be filled in/);
      }
    }
  });

  it("are written with voseo in Spanish", () => {
    const tuteo = /\b(puedes|tienes|debes|eres|quieres|piensas|haces|sabes|necesitas|escríbenos|contáctanos)\b/i;
    for (const id of LEGAL_DOCUMENT_IDS) {
      for (const text of texts(LEGAL_CONTENT.es[id])) expect(text, text).not.toMatch(tuteo);
    }
  });

  it("come out with every detail filled in when there is a contact email", () => {
    for (const locale of ["es", "en"] as const) {
      for (const id of LEGAL_DOCUMENT_IDS) {
        for (const text of texts(getLegalDocument(id, locale, "hola@tradfal.test"))) expect(text).not.toMatch(/\{\w+\}/);
      }
    }
    const filled = texts(getLegalDocument("terms", "en", "hola@tradfal.test")).join("\n");
    expect(filled).toContain(`${MIN_AGE} or older`);
    expect(filled).toContain("hola@tradfal.test");
  });

  it("leave out what names the email when there is none, and nothing else", () => {
    for (const locale of ["es", "en"] as const) {
      for (const id of LEGAL_DOCUMENT_IDS) {
        const source = LEGAL_CONTENT[locale][id];
        const document = getLegalDocument(id, locale, null);
        const all = texts(document);
        for (const text of all) expect(text).not.toMatch(/\{\w+\}/);
        expect(document.sections.map((section) => section.id)).toEqual(source.sections.map((section) => section.id));
        const withoutEmail = texts(source).filter((text) => !text.includes("{email}"));
        expect(all.length, `${locale}/${id}`).toBe(withoutEmail.length);
      }
    }
  });
});

describe("the contact email", () => {
  it("is used trimmed, and an empty one counts as none", () => {
    expect(readLegalContactEmail({ legalContactEmail: " hola@tradfal.test " })).toBe("hola@tradfal.test");
    expect(readLegalContactEmail({ legalContactEmail: "  " })).toBeNull();
  });

  it("fills only the tokens that exist", () => {
    expect(fillLegalTokens("{email} y {nada}", { email: "a@b.test", minAge: "18" })).toBe("a@b.test y {nada}");
  });
});
