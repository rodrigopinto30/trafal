import { expect, test } from "@playwright/test";
import { PAGES, openPage } from "./helpers/pages";

/**
 * Every screen is valid HTML for the W3C's own checker (the Nu HTML Checker, the engine behind validator.w3.org), signed in or not
 * and in both languages. e2e/run.sh starts it locally (nothing is sent outside). What is checked is the HTML the server sends;
 * informative notes and warnings are not failures, errors are. The same HTML in every size, so it runs once (desktop).
 */
const VALIDATOR = process.env.E2E_VNU_URL ?? "http://127.0.0.1:8888";

type Message = { type: string; subType?: string; message: string; extract?: string; lastLine?: number };

/**
 * The only error accepted, because the framework writes it and it cannot be changed without losing what it gives: React 19 renders
 * every form bound to a Server Action with `action=""` (so the form also works without JavaScript), and HTML wants it non-empty.
 * Browsers treat an empty action as the page's own address. See docs/DECISIONS.md.
 */
const FRAMEWORK_ERRORS = [/^Bad value “” for attribute “action” on element “form”: Must be non-empty\.$/];

for (const target of PAGES) {
  test(`${target.name}: HTML válido según el validador de la W3C`, async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "El HTML es el mismo en todos los tamaños");
    const response = await openPage(page, target, testInfo.project.name);
    expect(response, "la página respondió").not.toBeNull();
    const html = await response!.text();
    const checked = await request.post(`${VALIDATOR}/?out=json`, { headers: { "Content-Type": "text/html; charset=utf-8" }, data: html });
    expect(checked.ok(), "el validador respondió (¿está corriendo? e2e/run.sh lo levanta)").toBe(true);
    const { messages } = (await checked.json()) as { messages: Message[] };
    const errors = messages.filter(
      (message) => (message.type === "error" || message.type === "non-document-error") && !FRAMEWORK_ERRORS.some((known) => known.test(message.message)),
    );
    expect(errors.map((error) => `${error.message} — ${(error.extract ?? "").replace(/\s+/g, " ").slice(0, 120)}`)).toEqual([]);
  });
}
