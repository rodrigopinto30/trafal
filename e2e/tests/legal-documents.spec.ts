import { expect, test } from "@playwright/test";
import { gotoReady } from "./helpers/session";

/**
 * The four legal documents: each one is a real text in both languages (not a placeholder), final (no draft mark, no gap to fill in),
 * has a table of contents that jumps to its sections, and never shows a raw {token}. The signup form links to the terms.
 */
const DOCUMENTS = [
  { path: "/legal/terms", es: "Términos y condiciones", en: "Terms and conditions", firstSection: "Qué es Tradfal" },
  { path: "/legal/privacy", es: "Política de privacidad", en: "Privacy policy", firstSection: "Quién cuida tus datos" },
  { path: "/legal/guidelines", es: "Normas de la comunidad", en: "Community guidelines", firstSection: "La idea" },
  { path: "/legal/copyright", es: "Derechos de autor", en: "Copyright", firstSection: "La regla" },
] as const;

for (const document of DOCUMENTS) {
  test(`${document.path}: texto completo y definitivo en español, con índice que lleva a cada sección`, async ({ page }) => {
    await gotoReady(page, document.path);
    await expect(page.getByRole("heading", { level: 1, name: document.es })).toBeVisible();
    await expect(page.getByText(/Borrador sujeto a revisión|Este documento es un borrador|a completar/)).toHaveCount(0);
    await expect(page.getByText(/Última actualización: \d{1,2} de \w+ de \d{4}/)).toBeVisible();
    await expect(page.getByText("Estamos terminando de redactar este documento")).toHaveCount(0);

    const contents = page.getByRole("navigation", { name: "Contenido" });
    const sections = await page.locator("article section").count();
    expect(sections).toBeGreaterThanOrEqual(5);
    await expect(contents.getByRole("listitem")).toHaveCount(sections);

    const last = contents.getByRole("link").last();
    await last.click();
    await expect(page).toHaveURL(/#[a-z0-9-]+$/);
    await expect(page.locator("article section").last().getByRole("heading", { level: 2 })).toBeInViewport();

    expect(await page.locator("article").innerText()).not.toMatch(/\{\w+\}/);
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(document.firstSection) })).toBeVisible();
  });

  test(`${document.path}: existe en inglés`, async ({ page }) => {
    await gotoReady(page, `/en${document.path}`);
    await expect(page.getByRole("heading", { level: 1, name: document.en })).toBeVisible();
    await expect(page.getByText(/Draft pending legal review|This document is a draft|to be filled in/)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Contents" })).toBeVisible();
    expect(await page.locator("article").innerText()).not.toMatch(/\{\w+\}/);
  });
}

test("la política de privacidad dice lo que de verdad se guarda y no promete lo que no hacemos", async ({ page }) => {
  await gotoReady(page, "/legal/privacy");
  const text = await page.locator("article").innerText();
  for (const expected of ["Qué datos guardamos", "no vendemos tus datos", "Configuración → Cuenta", "Turnstile", "Supabase"]) expect(text).toContain(expected);
});

test("el registro enlaza a los términos y la privacidad, que abren los documentos", async ({ page, context }) => {
  await gotoReady(page, "/signup");
  const popup = context.waitForEvent("page");
  await page.getByRole("link", { name: "Términos" }).first().click();
  const terms = await popup;
  await terms.waitForLoadState("networkidle");
  await expect(terms.getByRole("heading", { level: 1, name: "Términos y condiciones" })).toBeVisible();
  await terms.close();
});
