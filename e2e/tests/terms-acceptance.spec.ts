import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, callRpc } from "./helpers/supabase";

/**
 * Accepting the terms again. A new account has the current version: no notice, and the screen sends it away. When its version is
 * older (here recorded by the account itself, which is all the database function lets anyone do), a notice shows on every page,
 * the pages that need a profile bring the person to the screen, accepting needs the box, and it takes them back where they were
 * going. Deleting the account stays reachable the whole time.
 */
test.describe.configure({ mode: "serial" });

const PASSWORD = "Trafal12345";
let page: Page;
let email = "";

const banner = (target: Page) => target.getByRole("status", { name: "Actualizamos nuestros términos" });

async function recordOlderVersion() {
  const response = await callRpc("accept_terms", { p_terms_version: "2026-01-01", p_age_confirmed: true }, await accessTokenOf(email, PASSWORD));
  expect(response.status).toBeLessThan(300);
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  email = `e2e_terms_${suffix}@trafal.test`;
  page = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await registerAccount(page, { email, username: `terms_${lettersOnly(suffix)}`, displayName: "Persona Términos", password: PASSWORD });
});

test.afterAll(async () => {
  await page?.context().close();
});

test("con la versión vigente no hay aviso y la pantalla de aceptar manda a otro lado", async () => {
  await gotoReady(page, "/");
  await expect(page.getByRole("button", { name: /Tu cuenta|Abrir menú/ }).first()).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await gotoReady(page, "/accept-terms?next=%2Fsaved");
  await expect(page).toHaveURL(/\/saved$/);
});

test("con una versión vieja, el aviso aparece y las pantallas de la cuenta llevan a aceptar", async () => {
  await recordOlderVersion();
  await gotoReady(page, "/");
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).getByRole("link", { name: "Revisar y aceptar" })).toBeVisible();

  await page.goto("/saved");
  await expect(page).toHaveURL(/\/accept-terms\?next=%2Fsaved$/);
  await expect(page.getByRole("heading", { level: 1, name: "Actualizamos nuestros términos" })).toBeVisible();
  for (const name of ["Términos y condiciones", "Política de privacidad", "Normas de la comunidad", "Derechos de autor"]) {
    await expect(page.getByRole("list").getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Última actualización: \d{1,2} de \w+ de \d{4}/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("sin tildar la casilla no se acepta; tildada, se acepta y vuelve a donde iba", async () => {
  await gotoReady(page, "/accept-terms?next=%2Fsaved");
  await page.getByRole("button", { name: "Aceptar y seguir" }).click();
  await expect(page.getByText("Tildá la casilla para seguir.")).toBeVisible();
  await expect(page).toHaveURL(/\/accept-terms/);

  await page.getByRole("checkbox", { name: /18 años o más/ }).check();
  await page.getByRole("button", { name: "Aceptar y seguir" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(banner(page)).toHaveCount(0);
});

test("borrar la cuenta sigue disponible sin haber aceptado, y la pantalla existe en inglés", async () => {
  await recordOlderVersion();
  await gotoReady(page, "/settings/account");
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByRole("button", { name: "Eliminar mi cuenta" })).toBeVisible();

  await gotoReady(page, "/accept-terms");
  await page.getByRole("link", { name: "borrar tu cuenta" }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);

  await gotoReady(page, "/en/accept-terms");
  await expect(page.getByRole("heading", { level: 1, name: "We updated our terms" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept and continue" })).toBeVisible();
});

test("quien no tiene sesión no ve la pantalla: lo lleva a iniciar sesión", async ({ browser }, testInfo) => {
  const visitor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await visitor.goto("/accept-terms");
  await expect(visitor).toHaveURL(/\/login\?next=/);
  await visitor.context().close();
});
