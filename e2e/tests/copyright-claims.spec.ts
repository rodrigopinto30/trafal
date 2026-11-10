import { expect, test, type Page } from "@playwright/test";
import { gotoReady, loginAndWait, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, callRpc, publicGame } from "./helpers/supabase";

/**
 * Copyright claims: anyone sends one from the public form (no account), it has to point at a published game or update of the site,
 * and the admin takes it, hides what was claimed and resolves it, and can restore it. The test always leaves the seeded game published.
 */
test.describe.configure({ mode: "serial" });

const GAME = "colectivo-152";
const OWNER_REASON = "Reclamo de derechos de autor aceptado";

let visitor: Page;
let admin: Page;
let email = "";
let reference = "";

async function fillClaim(target: Page, links: string) {
  await target.getByLabel("Tu nombre completo", { exact: true }).fill("Carla Titular");
  await target.getByLabel("Email de contacto").fill(email);
  await target.getByLabel("Organización o empresa (opcional)").fill("Estudio Carla");
  await target.getByLabel("Qué obra es tuya y por qué creés que la copiaron").fill("Una hoja de sprites que dibujé en 2024 y publiqué en mi sitio.");
  await target.getByLabel("Enlace a la obra original (opcional)").fill("https://example.com/mi-obra");
  await target.getByLabel("Enlaces a lo que reclamás en Trafal").fill(links);
  await target.getByLabel("Firma (escribí tu nombre completo)").fill("Carla Titular");
  await target.getByLabel(/Creo de buena fe/).check();
  await target.getByLabel(/Declaro que la información/).check();
}

test.beforeAll(async ({ browser }, testInfo) => {
  email = `e2e_claim_${uniqueSuffix(testInfo.project.name)}@trafal.test`;
  visitor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  admin = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(admin, "admin@trafal.test", "trafal123");
});

test.afterAll(async () => {
  const token = await accessTokenOf("admin@trafal.test", "trafal123");
  const row = await publicGame(GAME, "id,status");
  if (row?.status === "hidden") await callRpc("moderate_content", { p_target_type: "game", p_target_id: row.id, p_action: "restore", p_reason: "Limpieza de la prueba" }, token);
  await visitor?.context().close();
  await admin?.context().close();
});

test("desde la página de derechos de autor se llega al formulario, sin necesidad de cuenta", async () => {
  await gotoReady(visitor, "/legal/copyright");
  await visitor.getByRole("link", { name: "Enviar un reclamo de derechos de autor" }).click();
  await expect(visitor).toHaveURL(/\/legal\/copyright\/claim$/);
  await expect(visitor.getByRole("heading", { level: 1, name: "Reclamo de derechos de autor" })).toBeVisible();
  await expect(visitor.getByText("No hace falta tener una cuenta.")).toBeVisible();
});

test("el formulario avisa de lo que falta y de enlaces que no son de Trafal", async () => {
  await gotoReady(visitor, "/legal/copyright/claim");
  await visitor.getByRole("button", { name: "Enviar reclamo" }).click();
  await expect(visitor.getByText("Escribí tu nombre completo.").first()).toBeVisible();
  await expect(visitor.getByText("Escribí un email válido.")).toBeVisible();
  await expect(visitor.getByText("Pegá al menos un enlace.")).toBeVisible();
  await expect(visitor.getByText("Tenés que marcar las dos declaraciones.")).toBeVisible();

  await fillClaim(visitor, "https://otro-sitio.example/games/colectivo-152");
  await visitor.getByRole("button", { name: "Enviar reclamo" }).click();
  await expect(visitor.getByText("Ninguno de los enlaces es de un juego o un avance de Trafal que esté publicado.")).toBeVisible();
  await expect(visitor.getByLabel("Tu nombre completo", { exact: true })).toHaveValue("Carla Titular");
});

test("se envía un reclamo y se recibe un número de referencia", async () => {
  await fillClaim(visitor, `http://localhost:3000/games/${GAME}`);
  await visitor.getByRole("button", { name: "Enviar reclamo" }).click();
  await expect(visitor.getByRole("heading", { name: "Recibimos tu reclamo" })).toBeVisible();
  reference = /referencia es ([0-9A-F]{8})/.exec((await visitor.getByRole("status").filter({ hasText: "referencia" }).textContent()) ?? "")?.[1] ?? "";
  expect(reference).toHaveLength(8);
});

test("la administración lo ve con todo lo que se mandó", async () => {
  await gotoReady(admin, "/admin/claims");
  const card = admin.getByRole("article", { name: "Reclamo de Carla Titular" }).filter({ hasText: `#${reference}` });
  await expect(card).toBeVisible();
  await expect(card.getByText("Estudio Carla")).toBeVisible();
  await expect(card.getByRole("link", { name: email })).toBeVisible();
  await expect(card.getByText("Una hoja de sprites que dibujé en 2024")).toBeVisible();
  await expect(card.getByRole("link", { name: "Colectivo 152" })).toBeVisible();
  await expect(card.getByText("Publicado")).toBeVisible();
});

test("se toma, se oculta lo reclamado con un motivo y el juego deja de verse", async () => {
  const card = admin.getByRole("article", { name: "Reclamo de Carla Titular" }).filter({ hasText: `#${reference}` });
  const take = card.getByRole("button", { name: "Tomar" });
  await expect(take).toBeEnabled();
  await take.click();
  await expect(admin.getByText("Reclamo tomado")).toBeVisible();
  await admin.getByRole("link", { name: /^En revisión/ }).click();

  const reviewing = admin.getByRole("article", { name: "Reclamo de Carla Titular" }).filter({ hasText: `#${reference}` });
  const hide = reviewing.getByRole("button", { name: "Ocultar lo reclamado y resolver" });
  await expect(hide).toBeEnabled();
  await hide.click();
  const dialog = admin.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await dialog.getByLabel(/Motivo/).fill(OWNER_REASON);
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(admin.getByText("Contenido oculto y reclamo resuelto")).toBeVisible();

  expect(await publicGame(GAME, "status")).toBeNull();
});

test("queda en el registro y se puede restaurar", async () => {
  await gotoReady(admin, "/admin/claims?status=resolved");
  const card = admin.getByRole("article", { name: "Reclamo de Carla Titular" }).filter({ hasText: `#${reference}` });
  await expect(card.getByText("Oculto")).toBeVisible();
  const restore = card.getByRole("button", { name: "Restaurar el juego" });
  await expect(restore).toBeEnabled();
  await restore.click();
  await admin.getByRole("dialog").getByLabel(/Motivo/).fill("Se aclaró que la obra es propia");
  await admin.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(admin.getByText("Contenido restaurado")).toBeVisible();
  expect((await publicGame(GAME, "status"))?.status).toBe("published");

  await gotoReady(admin, "/admin/log");
  await expect(admin.getByRole("row", { name: new RegExp(`Resolvió un reclamo de derechos de autor.*${OWNER_REASON}`) }).first()).toBeVisible();
});
