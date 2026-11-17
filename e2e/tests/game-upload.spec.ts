import { expect, test, type Page } from "@playwright/test";
import { makePng } from "./helpers/images";
import { gotoReady, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, callRpc, insertRow, ownGame, userIdOf } from "./helpers/supabase";
import { GAME_PAGE_URL, publicIdOf, uniqueTitle } from "./helpers/game";
import { validGameZip } from "./helpers/zip";

/**
 * Uploading a game: the form creates the draft, the browser uploads the zip straight to quarantine with a presigned URL, the
 * upload is confirmed so the version enters the review queue and the form waits for the review; once the zip passes, the owner
 * lands on the game's page, which offers to publish it. Accounts are new on every run so the daily quota is never shared, and
 * game names are unique on every run because two games cannot share a name.
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
  await page.getByRole("textbox", { name: "Etiquetas" }).fill("pixel art, Retro, relax");
  await page.getByRole("textbox", { name: "Cómo se juega" }).fill("Flechas para moverte y espacio para saltar.");
}

async function goToUpload(page: Page) {
  const open = page.getByRole("button", { name: "Abrir menú" });
  if (await open.isVisible()) await open.click();
  await page.getByRole("navigation", { name: /Principal|Menú móvil/ }).getByRole("link", { name: "Subir juego" }).click();
  await expect(page).toHaveURL(/\/games\/new$/);
  await page.waitForLoadState("networkidle");
}

async function attachZip(page: Page, name = "moon-runner.zip") {
  await page.getByLabel("Archivo .zip del juego").setInputFiles({ name, mimeType: "application/zip", buffer: validGameZip() });
}

test("hay que iniciar sesión para subir un juego y se vuelve al formulario después", async ({ page }) => {
  await page.goto("/games/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fgames%2Fnew/);
});

test("subir un juego completo: la revisión se espera abajo, después se llega a su página y se publica o se baja desde ahí", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const username = await signUp(page, "subida", testInfo.project.name);
  const title = uniqueTitle("Moon Runner");

  await gotoReady(page, "/games/new");
  await expect(page.getByRole("heading", { level: 1, name: "Subir un juego" })).toBeVisible();
  await fillDetails(page, title);
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

  const progress = page.getByRole("status").filter({ hasText: "Revisando tu juego" });
  await expect(progress).toBeVisible({ timeout: 60_000 });
  await expect(progress.getByRole("listitem")).toHaveCount(3);
  await expect(progress.getByRole("listitem").nth(2)).toHaveAttribute("data-state", "current");
  const [progressBox, buttonBox] = await Promise.all([progress.boundingBox(), page.getByRole("button", { name: "Revisando tu juego…" }).boundingBox()]);
  expect(progressBox && buttonBox && progressBox.y < buttonBox.y, "the only progress card is the one next to the button").toBe(true);

  await expect(page).toHaveURL(GAME_PAGE_URL, { timeout: 60_000 });
  const ready = page.getByRole("dialog", { name: "¡Tu juego está listo!" });
  await expect(ready).toBeVisible();
  await expect(ready.getByRole("button", { name: "Publicar juego" })).toBeVisible();
  const publicId = publicIdOf(page);
  const publicUrl = `/games/${publicId}`;
  await ready.getByRole("button", { name: "Ahora no" }).click();
  await expect(ready).toBeHidden();

  const panel = page.getByRole("region", { name: "Tu juego" });
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(panel.getByText("Borrador", { exact: true })).toBeVisible();
  await expect(panel.getByText("Por ahora es un borrador y esta página solo la ves vos")).toBeVisible();
  await expect(page.getByText("Publicá tu juego para jugarlo acá")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comentarios" })).toHaveCount(0);
  await page.reload();
  await expect(panel).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`/u/${username}`);
  await expect(page.getByRole("heading", { name: "Tus juegos en preparación" })).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("link", { name: "Ver estado" }).click();
  await expect(page).toHaveURL(/\/manage$/);
  await expect(page.getByText("Lista", { exact: true })).toBeVisible();

  const stranger = await browser.newContext();
  const visitor = await stranger.newPage();
  await visitor.goto(publicUrl);
  await expect(visitor.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
  await expect(visitor.getByText(title)).toHaveCount(0);
  await visitor.goto(`${publicUrl}/manage`);
  await expect(visitor).toHaveURL(/\/login/);

  await gotoReady(page, publicUrl);
  await panel.getByRole("button", { name: "Publicar juego" }).click();
  await expect(page.getByText("¡Publicaste tu juego! Ya lo puede jugar cualquiera.")).toBeVisible();
  await expect(panel.getByText("Publicado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Jugar gratis" })).toBeVisible();
  await visitor.goto(publicUrl);
  await expect(visitor.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(visitor.getByRole("region", { name: "Tu juego" })).toHaveCount(0);
  await page.goto(`/u/${username}`);
  await expect(page.getByRole("heading", { name: "Tus juegos en preparación" })).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: title })).toBeVisible();

  await gotoReady(page, publicUrl);
  await panel.getByRole("button", { name: "Bajar juego" }).click();
  const confirm = page.getByRole("dialog", { name: "¿Bajar tu juego?" });
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(panel.getByText("Publicado", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Bajar juego" }).click();
  await confirm.getByRole("button", { name: "Bajar juego" }).click();
  await expect(page.getByText("Bajaste tu juego. Ahora solo lo ves vos.")).toBeVisible();
  await expect(panel.getByText("Borrador", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Publicar juego" })).toBeVisible();
  await visitor.goto(publicUrl);
  await expect(visitor.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
  await stranger.close();
});

test("dos juegos no pueden llamarse igual, aunque cambien las mayúsculas, y se avisa antes de subir el .zip", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const username = await signUp(page, "nombre", testInfo.project.name);
  await gotoReady(page, "/games/new");
  await fillDetails(page, "ÓRBITA");
  await attachZip(page);
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page.getByText("Ya hay un juego con ese nombre. Elegí otro.")).toBeVisible();
  await expect(page.getByLabel("Título")).toBeFocused();
  await expect(page).toHaveURL(/\/games\/new$/);
  await page.goto(`/u/${username}`);
  await expect(page.getByRole("heading", { name: "Tus juegos en preparación" })).toHaveCount(0);
});

test("el formulario solo pide lo del juego web: no pregunta por motor, celular, proporción ni primer juego", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await signUp(page, "soloweb", testInfo.project.name);
  await gotoReady(page, "/games/new");
  await expect(page.getByLabel("Título")).toBeVisible();
  await expect(page.getByLabel("Género")).toBeVisible();
  for (const label of [/Motor/, /Proporción/]) await expect(page.getByLabel(label)).toHaveCount(0);
  for (const name of [/celular/i, /primer juego/i]) await expect(page.getByRole("checkbox", { name })).toHaveCount(0);
});

test("al terminar de subir, la página del juego se abre arriba con el aviso, y al volver a «Subir juego» el formulario está vacío", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await signUp(page, "reinicio", testInfo.project.name);
  await gotoReady(page, "/games/new");
  await fillDetails(page, uniqueTitle("Juego de una sola vez"));
  await attachZip(page);
  await page.getByRole("button", { name: "Subir juego" }).click();

  await expect(page).toHaveURL(GAME_PAGE_URL, { timeout: 90_000 });
  const ready = page.getByRole("dialog", { name: "¡Tu juego está listo!" });
  await expect(ready).toBeVisible();
  await expect(ready.getByRole("button", { name: "Publicar juego" })).toBeInViewport({ ratio: 1 });
  await ready.getByRole("button", { name: "Ahora no" }).click();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(80);

  await goToUpload(page);
  const form = page.getByRole("main");
  await expect(form.getByRole("textbox", { name: "Título" })).toHaveValue("");
  await expect(form.getByRole("textbox", { name: "Descripción corta" })).toHaveValue("");
  await expect(form.getByRole("combobox", { name: "Género" })).toHaveValue("");
  await expect(form.getByRole("textbox", { name: "Etiquetas" })).toHaveValue("");
  await expect(form.getByRole("textbox", { name: "Cómo se juega" })).toHaveValue("");
  await expect(page.getByText("moon-runner.zip ·")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Subir juego" })).toBeEnabled();
});

test("el servidor valida otra vez: campos vacíos, imágenes falsas y diminutas se rechazan sin crear nada", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const username = await signUp(page, "valida", testInfo.project.name);
  await gotoReady(page, "/games/new");

  await attachZip(page);
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page.getByText("Poné un título de hasta 80 caracteres.")).toBeVisible();
  await expect(page.getByText("Elegí un género de la lista.")).toBeVisible();
  await expect(page.getByLabel("Título")).toBeFocused();

  await fillDetails(page, uniqueTitle("Con imágenes malas"));
  await page.getByLabel("Portada (opcional)").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: Buffer.from("<html>no soy una imagen</html>") });
  await page.getByLabel("Capturas (opcional)").setInputFiles({ name: "chica.png", mimeType: "image/png", buffer: makePng(100, 100) });
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page.getByText("La portada tiene que ser una imagen PNG, JPG o WebP válida.")).toBeVisible();
  await expect(page.getByText(/Las capturas tienen que ser imágenes/)).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue(/^Con imágenes malas /);

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
  await fillDetails(page, uniqueTitle("Se corta y sigue"));
  await attachZip(page);

  let blocked = true;
  await page.route("**/storage/v1/s3/quarantine/**", (route) => (blocked ? route.abort() : route.continue()));
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page.getByText("La subida se cortó.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Subir juego" })).toHaveCount(0);

  blocked = false;
  await page.getByRole("button", { name: "Reintentar la subida" }).click();
  await expect(page).toHaveURL(GAME_PAGE_URL, { timeout: 90_000 });
  await expect(page.getByRole("dialog", { name: "¡Tu juego está listo!" })).toBeVisible();
});

const PASSWORD = "Trafal12345";

/** A draft of the person of the token with one version that was registered but never uploaded (the upload «did not finish»). */
async function draftWithUnfinishedUpload(email: string, title: string) {
  const token = await accessTokenOf(email, PASSWORD);
  expect((await insertRow("games", { owner_id: userIdOf(token), title }, token)).status).toBe(201);
  const game = await ownGame(token, title);
  expect((await callRpc("create_game_version", { p_game_id: game.id, p_declared_size_bytes: 1000 }, token)).status).toBe(200);
  return { token, game };
}

test("mientras el juego no se puede publicar, la gestión dice por qué, muestra los pasos y deja el botón apagado", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const email = `e2e_estado_${suffix}@trafal.test`;
  await registerAccount(page, { email, username: `estado_${lettersOnly(suffix)}`, displayName: "Persona Estado" });
  const { game } = await draftWithUnfinishedUpload(email, uniqueTitle("Juego a medio subir"));

  await gotoReady(page, `/games/${game.public_id}/manage`);
  const status = page.getByRole("region", { name: "La subida no terminó" });
  await expect(status).toBeVisible();
  await expect(status.getByRole("listitem")).toHaveCount(3);
  await expect(status.getByRole("listitem").nth(0)).toHaveAttribute("data-state", "current");
  await expect(status.getByRole("listitem").nth(1)).toHaveAttribute("data-state", "waiting");
  await expect(status.getByRole("button", { name: "Publicar juego" })).toBeDisabled();
  await expect(status.getByText("Este botón se habilita cuando una versión pase la revisión.")).toBeVisible();
});

test("al llegar al límite de subidas por día, el aviso aparece pegado al botón y a la vista", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const email = `e2e_limite_${suffix}@trafal.test`;
  await registerAccount(page, { email, username: `limite_${lettersOnly(suffix)}`, displayName: "Persona Límite" });
  const { token, game } = await draftWithUnfinishedUpload(email, uniqueTitle("Juego que gasta las subidas"));
  for (let n = 2; n <= 5; n++) expect((await callRpc("create_game_version", { p_game_id: game.id, p_declared_size_bytes: 1000 }, token)).status).toBe(200);

  await gotoReady(page, "/games/new");
  const extraTitle = uniqueTitle("Una subida de más");
  await fillDetails(page, extraTitle);
  await attachZip(page);
  const submit = page.getByRole("button", { name: "Subir juego" });
  await submit.click();

  const notice = page.getByText("Llegaste al límite de 5 subidas por día");
  await expect(notice).toBeVisible();
  await expect(notice).toBeInViewport({ ratio: 1 });
  await expect(submit).toBeInViewport();
  const [noticeBox, buttonBox] = await Promise.all([notice.boundingBox(), submit.boundingBox()]);
  expect(noticeBox && buttonBox && noticeBox.y < buttonBox.y && buttonBox.y - noticeBox.y < 400).toBe(true);
  await expect(page.getByLabel("Título")).toHaveValue(extraTitle);
});

test("editar un juego ya subido: cambia los datos, la portada, las capturas y las preguntas, y se guarda todo junto", async ({ page, browser, request }, testInfo) => {
  test.setTimeout(240_000);
  const username = await signUp(page, "editar", testInfo.project.name);

  await gotoReady(page, "/games/new");
  const title = uniqueTitle("Juego para editar");
  const editedTitle = uniqueTitle("Juego editado");
  await fillDetails(page, title);
  await page.getByLabel("Pregunta 1").fill("¿El salto se siente bien?");
  await page.getByLabel("Pregunta 2").fill("¿Qué cambiarías?");
  await attachZip(page);
  await page.getByLabel("Portada (opcional)").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: makePng(640, 360) });
  await page.getByLabel("Capturas (opcional)").setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: makePng(640, 360, { color: [255, 100, 100] }) },
    { name: "b.png", mimeType: "image/png", buffer: makePng(640, 360, { color: [100, 255, 100] }) },
  ]);
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page).toHaveURL(GAME_PAGE_URL, { timeout: 90_000 });
  const publicId = publicIdOf(page);
  await page.getByRole("dialog", { name: "¡Tu juego está listo!" }).getByRole("button", { name: "Ahora no" }).click();

  await page.getByRole("region", { name: "Tu juego" }).getByRole("link", { name: "Editar" }).click();
  await expect(page).toHaveURL(new RegExp(`/games/${publicId}/edit$`));
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Editar tu juego" })).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue(title);
  await expect(page.getByLabel("Descripción corta")).toHaveValue("Corré por la luna y esquivá los cráteres.");
  await expect(page.getByLabel("Género")).toHaveValue("platformer");
  await expect(page.getByRole("textbox", { name: "Etiquetas" })).toHaveValue("pixel art, relax, retro");
  await expect(page.getByRole("textbox", { name: "Cómo se juega" })).toHaveValue("Flechas para moverte y espacio para saltar.");
  await expect(page.getByLabel("Pregunta 1")).toHaveValue("¿El salto se siente bien?");
  await expect(page.getByLabel("Pregunta 2")).toHaveValue("¿Qué cambiarías?");
  await expect(page.getByLabel("Pregunta 3")).toHaveValue("");
  const shots = page.getByRole("img", { name: /^Captura \d de tu juego$/ });
  await expect(shots).toHaveCount(2);
  const coverImage = page.getByText("Portada actual").locator("xpath=following::img[1]");
  const oldCoverUrl = (await coverImage.getAttribute("src")) ?? "";
  const oldShotUrl = (await shots.nth(0).getAttribute("src")) ?? "";
  expect(oldCoverUrl).not.toBe("");
  expect((await request.get(oldCoverUrl)).status()).toBe(200);

  await page.getByLabel("Título").fill("");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Poné un título de hasta 80 caracteres.")).toBeVisible();
  await expect(page.getByLabel("Título")).toBeFocused();

  await page.getByLabel("Título").fill("órbita");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Ya hay un juego con ese nombre. Elegí otro.")).toBeVisible();
  await expect(page.getByLabel("Título")).toBeFocused();

  await page.getByLabel("Título").fill(editedTitle);
  await page.getByLabel("Descripción corta").fill("Ahora con otra descripción.");
  await page.getByLabel("Género").selectOption("puzzle");
  await page.getByRole("textbox", { name: "Etiquetas" }).fill("relax, nuevo");
  await page.getByLabel("Pregunta 1").fill("¿El salto se siente mejor?");
  await page.getByLabel("Pregunta 2").fill("");
  await page.getByLabel("Pregunta 3").fill("¿Cuánto tardaste en terminarlo?");
  await page.getByLabel("Quitar la captura 1").check();
  await page.getByLabel("Reemplazar la portada").setInputFiles({ name: "nueva.png", mimeType: "image/png", buffer: makePng(800, 450, { color: [10, 10, 200] }) });
  await page.getByLabel("Agregar capturas").setInputFiles({ name: "c.png", mimeType: "image/png", buffer: makePng(640, 360, { color: [200, 200, 10] }) });
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page.getByText("Guardamos los cambios de tu juego.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/games/${publicId}/manage$`));
  await expect(page.getByRole("heading", { level: 1, name: editedTitle })).toBeVisible();

  await page.getByRole("link", { name: "Editar datos del juego" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Título")).toHaveValue(editedTitle);
  await expect(page.getByLabel("Descripción corta")).toHaveValue("Ahora con otra descripción.");
  await expect(page.getByLabel("Género")).toHaveValue("puzzle");
  await expect(page.getByRole("textbox", { name: "Etiquetas" })).toHaveValue("nuevo, relax");
  await expect(page.getByLabel("Pregunta 1")).toHaveValue("¿El salto se siente mejor?");
  await expect(page.getByLabel("Pregunta 2")).toHaveValue("¿Cuánto tardaste en terminarlo?");
  await expect(page.getByLabel("Pregunta 3")).toHaveValue("");
  await expect(page.getByRole("img", { name: /^Captura \d de tu juego$/ })).toHaveCount(2);
  const newCoverUrl = (await page.getByText("Portada actual").locator("xpath=following::img[1]").getAttribute("src")) ?? "";
  expect(newCoverUrl).not.toBe(oldCoverUrl);
  expect((await request.get(newCoverUrl)).status()).toBe(200);
  expect((await request.get(oldCoverUrl)).status()).not.toBe(200);
  expect((await request.get(oldShotUrl)).status()).not.toBe(200);

  await page.getByLabel("Quitar la portada").check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(new RegExp(`/games/${publicId}/manage$`));
  await page.goto(`/games/${publicId}/edit`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Todavía no tiene portada")).toBeVisible();
  expect((await request.get(newCoverUrl)).status()).not.toBe(200);

  const stranger = await browser.newContext();
  const visitor = await stranger.newPage();
  await visitor.goto(`/games/${publicId}/edit`);
  await expect(visitor).toHaveURL(/\/login/);
  await stranger.close();
  expect(username).not.toBe("");
});
