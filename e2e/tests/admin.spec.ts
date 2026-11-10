import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, logout, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, callRpc, gameIdOf, publicGame } from "./helpers/supabase";

/**
 * The administration: only admins get in, a report goes through the queue (take, hide and resolve, restore), everything
 * is written in the moderation log, and the first game of the week is chosen from its own screen. The test always leaves
 * the seeded data as it found it.
 */
test.describe.configure({ mode: "serial" });

const GAME = "colectivo-152";
const FEATURED_GAME = "kart-de-carton";
const FEATURED_QUOTE = "Frase elegida desde el panel";

function mondayOfThisWeek(): string {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

let page: Page;
let tag = "";
let hideReason = "";
let restoreReason = "";

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ ...testInfo.project.use });
  page = await context.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  tag = `Reporte de prueba ${suffix}`;
  hideReason = `Es spam, rompe las reglas ${suffix}`;
  restoreReason = `Fue un error, vuelve a estar publicado ${suffix}`;
  await registerAccount(page, { email: `e2e_admin_${suffix}@trafal.test`, username: `admin_${lettersOnly(suffix)}`, displayName: "Persona Reportera" });
});

test.afterAll(async () => {
  const token = await accessTokenOf("admin@trafal.test", "trafal123");
  const row = await publicGame(GAME, "id,status");
  if (row?.status === "hidden") await callRpc("moderate_content", { p_target_type: "game", p_target_id: row.id, p_action: "restore", p_reason: "Limpieza de la prueba" }, token);
  await callRpc("clear_featured_game", { p_week_start: mondayOfThisWeek() }, token);
  await page?.context().close();
});

test("una persona común no ve el panel ni el enlace, y un visitante va a iniciar sesión", async ({ browser }, testInfo) => {
  await gotoReady(page, "/admin");
  await expect(page.getByRole("heading", { name: "Administración" })).toHaveCount(0);
  await expect(page.getByText("Reportes", { exact: true })).toHaveCount(0);

  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto("/admin");
  await expect(visitor).toHaveURL(/\/login\?next=%2Fadmin/);
  await context.close();
});

test("el reporte de un juego llega a la cola y queda a la vista con su evidencia", async () => {
  await gotoReady(page, `/games/${GAME}`);
  await page.getByRole("button", { name: "Reportar", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo").selectOption("spam");
  await dialog.getByLabel(/Detalles/).fill(tag);
  await dialog.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(dialog.getByText("Recibimos tu reporte")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await logout(page);
  await loginAndWait(page, "admin@trafal.test", "trafal123");
  await gotoReady(page, "/admin");
  await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();
  const card = page.getByRole("article", { name: "Juego · Spam" }).filter({ hasText: tag });
  await expect(card).toBeVisible();
  await expect(card.getByText("Colectivo 152").first()).toBeVisible();
  await expect(card.getByText("Publicado")).toBeVisible();
});

test("tomar el reporte lo pasa a «En revisión»", async () => {
  const card = page.getByRole("article", { name: "Juego · Spam" }).filter({ hasText: tag });
  const take = card.getByRole("button", { name: "Tomar" });
  await expect(take).toBeEnabled();
  await take.click();
  await expect(page.getByText("Reporte tomado")).toBeVisible();
  await page.getByRole("link", { name: /^En revisión/ }).click();
  await expect(page.getByRole("article", { name: "Juego · Spam" }).filter({ hasText: tag })).toBeVisible();
});

test("ocultar y resolver oculta el juego, avisa a su dueño y queda en el registro; restaurar lo devuelve", async () => {
  await gotoReady(page, "/admin?status=reviewing");
  const card = page.getByRole("article", { name: "Juego · Spam" }).filter({ hasText: tag });
  const hide = card.getByRole("button", { name: "Ocultar y resolver" });
  await expect(hide).toBeEnabled();
  await hide.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await dialog.getByLabel(/Motivo/).fill(hideReason);
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Contenido oculto y reporte resuelto")).toBeVisible();

  expect((await publicGame(GAME, "status")) ?? null).toBeNull();

  await gotoReady(page, "/admin?status=resolved");
  const resolved = page.getByRole("article", { name: "Juego · Spam" }).filter({ hasText: tag });
  await expect(resolved.getByText("Oculto")).toBeVisible();
  const restore = resolved.getByRole("button", { name: "Restaurar contenido" });
  await expect(restore).toBeEnabled();
  await restore.click();
  await page.getByRole("dialog").getByLabel(/Motivo/).fill(restoreReason);
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Contenido restaurado")).toBeVisible();
  expect((await publicGame(GAME, "status"))?.status).toBe("published");

  await page.getByRole("link", { name: "Registro" }).click();
  await expect(page).toHaveURL(/\/admin\/log/);
  await expect(page.getByRole("row", { name: new RegExp(`Ocultó un juego.*${hideReason}`) })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(`Restauró un juego.*${restoreReason}`) })).toBeVisible();
});

test("elegir el juego de la semana desde el panel lo muestra en la portada y se puede sacar", async () => {
  await gotoReady(page, "/admin/featured");
  await page.getByLabel("Juego", { exact: true }).selectOption(await gameIdOf(FEATURED_GAME));
  await page.getByLabel(/Frase/).fill(FEATURED_QUOTE);
  const choose = page.getByRole("button", { name: "Elegir", exact: true });
  await expect(choose).toBeEnabled();
  await choose.click();
  await expect(page.getByText("Juego elegido")).toBeVisible();
  await expect(page.getByText(FEATURED_QUOTE)).toBeVisible();

  await gotoReady(page, "/");
  await expect(page.getByText(FEATURED_QUOTE)).toBeVisible();

  await gotoReady(page, "/admin/featured");
  const clear = page.getByRole("button", { name: "Sacar" });
  await expect(clear).toBeEnabled();
  await clear.click();
  await expect(page.getByText("Elección sacada")).toBeVisible();
  await expect(page.getByText(FEATURED_QUOTE)).toHaveCount(0);
});
