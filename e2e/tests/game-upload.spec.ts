import { expect, test, type Page } from "@playwright/test";
import { makePng } from "./helpers/images";
import { gotoReady, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { validGameZip } from "./helpers/zip";

/**
 * Uploading a game: the form creates the draft, the browser uploads the zip straight to quarantine with a presigned URL, and
 * the upload is confirmed so the version enters the review queue; the worker then publishes its files («Lista») and the owner
 * decides when to publish the game. Accounts are new on every run so the daily quota is never shared.
 */
async function signUp(page: Page, testName: string, projectName: string) {
  const suffix = uniqueSuffix(projectName);
  const username = `${testName}_${lettersOnly(suffix)}`;
  await registerAccount(page, { email: `e2e_${testName}_${suffix}@trafal.test`, username, displayName: "Persona Subida" });
  return username;
}

async function fillDetails(page: Page, title: string) {
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descripción corta").fill("Corré por la luna y esquivá los cráteres.");
  await page.getByLabel("Género").selectOption("platformer");
  await page.getByLabel("Motor").selectOption("godot");
  await page.getByLabel("Etiquetas").fill("pixel art, Retro, relax");
  await page.getByLabel("Cómo se juega").fill("Flechas para moverte y espacio para saltar.");
}

async function attachZip(page: Page, name = "moon-runner.zip") {
  await page.getByLabel("Archivo .zip del juego").setInputFiles({ name, mimeType: "application/zip", buffer: validGameZip() });
}

test("hay que iniciar sesión para subir un juego y se vuelve al formulario después", async ({ page }) => {
  await page.goto("/games/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fgames%2Fnew/);
});

test("subir un juego completo: queda como borrador en revisión y solo lo ve su dueño", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const username = await signUp(page, "subida", testInfo.project.name);

  await gotoReady(page, "/games/new");
  await expect(page.getByRole("heading", { level: 1, name: "Subir un juego" })).toBeVisible();
  await fillDetails(page, "Moon Runner");
  await page.getByRole("checkbox", { name: "Funciona en celular" }).check();
  await page.getByRole("checkbox", { name: "Es mi primer juego" }).check();
  await page.getByLabel("Pregunta 1").fill("¿El salto se siente bien?");
  await page.getByLabel("Pregunta 2").fill("¿Qué cambiarías?");
  await attachZip(page);
  await page.getByLabel("Portada (opcional)").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: makePng(640, 360) });
  await page.getByLabel("Capturas (opcional)").setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: makePng(640, 360, { color: [255, 100, 100] }) },
    { name: "b.png", mimeType: "image/png", buffer: makePng(640, 360, { color: [100, 255, 100] }) },
  ]);
  await expect(page.getByText("moon-runner.zip ·")).toBeVisible();
  await page.getByRole("button", { name: "Subir juego" }).click();

  await expect(page).toHaveURL(/\/games\/[a-z0-9]+\/manage$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Moon Runner" })).toBeVisible();
  await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Versión v1" })).toBeVisible();
  await expect(page.getByText("Lista", { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Tu juego pasó la revisión y sigue siendo un borrador")).toBeVisible();
  const publicUrl = page.url().replace("/manage", "");

  await page.goto(`/u/${username}`);
  await expect(page.getByRole("heading", { name: "Tus juegos en preparación" })).toBeVisible();
  await expect(page.getByText("Moon Runner")).toBeVisible();
  await page.getByRole("link", { name: "Ver estado" }).click();
  await expect(page).toHaveURL(/\/manage$/);

  const stranger = await browser.newContext();
  const visitor = await stranger.newPage();
  await visitor.goto(publicUrl);
  await expect(visitor.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
  await expect(visitor.getByText("Moon Runner")).toHaveCount(0);
  await visitor.goto(`${publicUrl}/manage`);
  await expect(visitor).toHaveURL(/\/login/);

  await page.getByRole("button", { name: "Publicar juego" }).click();
  await expect(page.getByText("Tu juego está publicado")).toBeVisible();
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();
  await visitor.goto(publicUrl);
  await expect(visitor.getByRole("heading", { level: 1, name: "Moon Runner" })).toBeVisible();
  await page.goto(`/u/${username}`);
  await expect(page.getByRole("heading", { name: "Tus juegos en preparación" })).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: "Moon Runner" })).toBeVisible();

  await page.goto(`${publicUrl}/manage`);
  await page.getByRole("button", { name: "Volver a borrador" }).click();
  await expect(page.getByText("Tu juego pasó la revisión y sigue siendo un borrador")).toBeVisible();
  await visitor.goto(publicUrl);
  await expect(visitor.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
  await stranger.close();
});

test("el servidor valida otra vez: campos vacíos, imágenes falsas y diminutas se rechazan sin crear nada", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const username = await signUp(page, "valida", testInfo.project.name);
  await gotoReady(page, "/games/new");

  await attachZip(page);
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page.getByText("Poné un título de hasta 80 caracteres.")).toBeVisible();
  await expect(page.getByText("Elegí un género de la lista.")).toBeVisible();
  await expect(page.getByText("Elegí un motor de la lista.")).toBeVisible();
  await expect(page.getByLabel("Título")).toBeFocused();

  await fillDetails(page, "Con imágenes malas");
  await page.getByLabel("Portada (opcional)").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: Buffer.from("<html>no soy una imagen</html>") });
  await page.getByLabel("Capturas (opcional)").setInputFiles({ name: "chica.png", mimeType: "image/png", buffer: makePng(100, 100) });
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page.getByText("La portada tiene que ser una imagen PNG, JPG o WebP válida.")).toBeVisible();
  await expect(page.getByText(/Las capturas tienen que ser imágenes/)).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue("Con imágenes malas");

  await page.getByLabel("Portada (opcional)").setInputFiles({ name: "animada.png", mimeType: "image/png", buffer: makePng(640, 360, { animated: true }) });
  await page.getByLabel("Capturas (opcional)").setInputFiles([]);
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page.getByText("La portada no puede ser animada.")).toBeVisible();

  await page.goto(`/u/${username}`);
  await expect(page.getByRole("heading", { name: "Tus juegos en preparación" })).toHaveCount(0);
});

test("un archivo que no es .zip se avisa antes de enviar nada", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await signUp(page, "nozip", testInfo.project.name);
  await gotoReady(page, "/games/new");
  await page.getByLabel("Archivo .zip del juego").setInputFiles({ name: "juego.rar", mimeType: "application/x-rar", buffer: Buffer.from("x") });
  await expect(page.getByText("El archivo tiene que ser un .zip.")).toBeVisible();
});

test("si la subida se corta, el juego ya creado se puede reintentar con el mismo archivo", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await signUp(page, "reintento", testInfo.project.name);
  await gotoReady(page, "/games/new");
  await fillDetails(page, "Se corta y sigue");
  await attachZip(page);

  let blocked = true;
  await page.route("**/storage/v1/s3/quarantine/**", (route) => (blocked ? route.abort() : route.continue()));
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page.getByText("La subida se cortó.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Subir juego" })).toHaveCount(0);

  blocked = false;
  await page.getByRole("button", { name: "Reintentar la subida" }).click();
  await expect(page).toHaveURL(/\/games\/[a-z0-9]+\/manage$/, { timeout: 60_000 });
  await expect(page.getByText("Lista", { exact: true })).toBeVisible({ timeout: 45_000 });
});
