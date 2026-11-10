import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, logout, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, restoreCommentByBody } from "./helpers/supabase";

/**
 * Reporting an update, a comment and a profile (the game is covered in game-player.spec.ts): who sees the button, what the
 * dialog offers, that the same thing cannot be reported twice, and that the report reaches the admin with the evidence. One new
 * account reports on the seeded game «Órbita»; the admin hides the reported comment and restores it.
 */
test.describe.configure({ mode: "serial" });

const GAME = "/games/orbita";
const SEEDED_COMMENT = "Me encantó usar la gravedad de las estrellas";
const POST_TEXT = "Probando un planeta con anillos";
const PROFILE = "/u/valen_makes";

let page: Page;
let suffix = "";
let username = "";

function postCard(target: Page) {
  return target.locator("article").filter({ visible: true }).filter({ hasText: POST_TEXT });
}

function commentCard(target: Page) {
  return target.locator("article").filter({ visible: true }).filter({ hasText: SEEDED_COMMENT });
}

async function report(target: Page, trigger: ReturnType<Page["getByRole"]>, reason: string, detail: string) {
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = target.getByRole("dialog");
  await dialog.getByLabel("Motivo").selectOption(reason);
  await dialog.getByLabel(/Detalles/).fill(detail);
  await dialog.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(dialog.getByText("Recibimos tu reporte")).toBeVisible();
  await target.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ ...testInfo.project.use });
  page = await context.newPage();
  suffix = uniqueSuffix(testInfo.project.name);
  username = `reports_${lettersOnly(suffix)}`;
  await registerAccount(page, { email: `e2e_reports_${suffix}@trafal.test`, username, displayName: "Persona Reportes" });
});

test.afterAll(async () => {
  await restoreCommentByBody(SEEDED_COMMENT, await accessTokenOf("admin@trafal.test", "trafal123"));
  await page?.context().close();
});

test("un visitante ve los botones, pero lo llevan a iniciar sesión", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await gotoReady(visitor, GAME);
  await postCard(visitor).getByRole("button", { name: "Reportar el avance" }).click();
  await expect(visitor.getByText("Para reportar tenés que iniciar sesión")).toBeVisible();
  await expect(visitor.getByRole("dialog").getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", new RegExp(`/login\\?next=%2Fgames%2Forbita`));
  await context.close();
});

test("el motivo «No funciona» es solo de los juegos", async () => {
  await gotoReady(page, GAME);
  await page.getByRole("button", { name: "Reportar", exact: true }).first().click();
  await expect(page.getByRole("dialog").getByLabel("Motivo").locator("option", { hasText: "No funciona" })).toHaveCount(1);
  await page.keyboard.press("Escape");

  await postCard(page).getByRole("button", { name: "Reportar el avance" }).click();
  await expect(page.getByRole("dialog", { name: "Reportar este avance" })).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Motivo").locator("option", { hasText: "No funciona" })).toHaveCount(0);
  await expect(page.getByRole("dialog").getByLabel("Motivo").locator("option", { hasText: "Derechos de autor" })).toHaveCount(1);
  await page.keyboard.press("Escape");
});

test("se reporta un avance, un comentario y un perfil, y cada uno solo una vez", async () => {
  await gotoReady(page, GAME);
  await report(page, postCard(page).getByRole("button", { name: "Reportar el avance" }), "spam", `Avance ${suffix}`);
  await report(page, commentCard(page).getByRole("button", { name: "Reportar", exact: true }), "abuse", `Comentario ${suffix}`);

  await postCard(page).getByRole("button", { name: "Reportar el avance" }).click();
  await page.getByRole("dialog").getByLabel("Motivo").selectOption("abuse");
  await page.getByRole("dialog").getByRole("button", { name: "Enviar reporte" }).click();
  await expect(page.getByText("Ya reportaste esto")).toBeVisible();
  await page.keyboard.press("Escape");

  await gotoReady(page, PROFILE);
  await report(page, page.getByRole("button", { name: "Reportar el perfil" }), "other", `Perfil ${suffix}`);
});

test("no hay botón de reporte en lo propio", async () => {
  await gotoReady(page, `/u/${username}`);
  await expect(page.getByRole("button", { name: "Reportar el perfil" })).toHaveCount(0);
});

test("la administración ve los tres reportes con su evidencia, oculta el comentario y lo restaura", async ({ browser }, testInfo) => {
  await logout(page);
  await loginAndWait(page, "admin@trafal.test", "trafal123");
  await gotoReady(page, "/admin");

  const post = page.getByRole("article", { name: "Avance · Spam" }).filter({ hasText: `Avance ${suffix}` });
  const comment = page.getByRole("article", { name: "Comentario · Acoso o abuso" }).filter({ hasText: `Comentario ${suffix}` });
  const profile = page.getByRole("article", { name: "Perfil · Otro" }).filter({ hasText: `Perfil ${suffix}` });
  await expect(post.getByText(POST_TEXT)).toBeVisible();
  await expect(comment.getByText(SEEDED_COMMENT)).toBeVisible();
  await expect(profile.getByText(/valen_makes/)).toBeVisible();
  await expect(profile.getByRole("button", { name: "Ocultar y resolver" })).toHaveCount(0);

  const hide = comment.getByRole("button", { name: "Ocultar y resolver" });
  await expect(hide).toBeEnabled();
  await hide.click();
  await page.getByRole("dialog").getByLabel(/Motivo/).fill(`Acoso ${suffix}`);
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Contenido oculto y reporte resuelto")).toBeVisible();

  const visitorContext = await browser.newContext({ ...testInfo.project.use });
  const visitor = await visitorContext.newPage();
  await gotoReady(visitor, GAME);
  await expect(visitor.getByText(SEEDED_COMMENT)).toHaveCount(0);
  await visitorContext.close();

  await gotoReady(page, "/admin?status=resolved");
  const resolved = page.getByRole("article", { name: "Comentario · Acoso o abuso" }).filter({ hasText: `Comentario ${suffix}` });
  const restore = resolved.getByRole("button", { name: "Restaurar contenido" });
  await expect(restore).toBeEnabled();
  await restore.click();
  await page.getByRole("dialog").getByLabel(/Motivo/).fill(`Restaurado ${suffix}`);
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Contenido restaurado")).toBeVisible();

  await gotoReady(page, GAME);
  await expect(page.getByText(SEEDED_COMMENT)).toBeVisible();

  await gotoReady(page, "/admin");
  for (const card of [post, profile]) {
    await card.getByRole("button", { name: "Descartar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Reporte descartado")).toBeVisible();
  }
});
