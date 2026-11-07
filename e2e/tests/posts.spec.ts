import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { uploadGameZip } from "./helpers/game";
import { makePng } from "./helpers/images";
import { makeGif, makeMp4 } from "./helpers/post-media";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";
import { playableGameZip } from "./helpers/zip";

/**
 * Publishing, editing and deleting updates with pictures, a GIF and a video. One new account owns a published game and every
 * update below. Needs the whole stack running (./start.sh), the worker included.
 */
test.describe.configure({ mode: "serial" });

const SITE = "http://localhost:3000";

let context: BrowserContext;
let author: Page;
let username = "";
let publicId = "";

const FILES = {
  png: { name: "nivel-2.png", mimeType: "image/png", buffer: makePng(64, 48) },
  gif: { name: "salto.gif", mimeType: "image/gif", buffer: makeGif(32, 24, 3) },
  mp4: { name: "partida.mp4", mimeType: "video/mp4", buffer: makeMp4(640, 360) },
};

function card(page: Page, text: string) {
  return page.locator("article").filter({ visible: true }).filter({ hasText: text });
}

async function openPostsTab(page: Page) {
  await gotoReady(page, `/u/${username}`);
  await page.getByRole("tab", { name: "Avances" }).click();
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  context = await browser.newContext({ ...testInfo.project.use });
  author = await context.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  username = `posts_${lettersOnly(suffix)}`;
  await registerAccount(author, { email: `e2e_posts_${suffix}@trafal.test`, username, displayName: "Persona Avances" });
  await uploadGameZip(author, "Juego de avances", playableGameZip());
  await expect(author.getByText("Lista", { exact: true })).toBeVisible({ timeout: 45_000 });
  await author.getByRole("button", { name: "Publicar juego" }).click();
  await expect(author.getByText("Tu juego está publicado")).toBeVisible();
  publicId = /\/games\/([a-z0-9]+)\/manage$/.exec(author.url())?.[1] ?? "";
  expect(publicId).not.toBe("");
});

test.afterAll(async () => {
  await context?.close();
});

test("quien no tiene sesión que entra a publicar pasa por el login y vuelve", async ({ browser }, testInfo) => {
  const visitor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await visitor.goto("/posts/new");
  await expect(visitor).toHaveURL(/\/login\?next=%2Fposts%2Fnew/);
  await visitor.context().close();
});

test("se publica un avance con una imagen, un GIF y un video, y se ven en el perfil", async () => {
  await openPostsTab(author);
  await author.getByRole("link", { name: "Publicar un avance" }).first().click();
  await expect(author).toHaveURL(/\/posts\/new$/);
  await expect(author.getByRole("heading", { level: 1, name: "Publicar un avance" })).toBeVisible();
  await author.waitForLoadState("networkidle");

  await author.getByLabel("Qué querés contar").fill("Probé el nivel 2 con salto doble.");
  await author.getByLabel("Elegir archivos").setInputFiles([FILES.png, FILES.gif, FILES.mp4]);
  await expect(author.getByRole("list", { name: "Archivos elegidos" }).getByRole("listitem")).toHaveCount(3);
  await author.getByLabel("Descripción de nivel-2.png (opcional)").fill("Captura del nivel 2");
  await author.getByRole("button", { name: "Publicar", exact: true }).click();

  await expect(author).toHaveURL(new RegExp(`/u/${username}$`), { timeout: 30_000 });
  await author.getByRole("tab", { name: "Avances" }).click();
  const published = card(author, "Probé el nivel 2 con salto doble.");
  await expect(published).toBeVisible();
  const image = published.getByRole("img", { name: "Captura del nivel 2" });
  await expect(image).toBeVisible();
  await expect(published.getByRole("img", { name: "GIF del avance" })).toBeVisible();
  const video = published.locator("video");
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("preload", "none");

  const imageUrl = (await image.getAttribute("src")) ?? "";
  expect(imageUrl).toMatch(/\/posts\/[0-9a-f-]{36}\/[0-9a-f]{32}\.png$/);
  const served = await author.request.get(imageUrl);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toContain("image/png");
  const videoUrl = (await video.getAttribute("src")) ?? "";
  expect((await author.request.get(videoUrl)).headers()["content-type"]).toContain("video/mp4");
});

test("el formulario avisa de lo que falta y el servidor rechaza archivos falsos sin dejar nada publicado", async () => {
  await gotoReady(author, "/posts/new");
  await author.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(author.getByText("Escribí algo para publicar.")).toBeVisible();

  await author.getByLabel("Tipo de publicación").selectOption("nuevo_juego");
  await author.getByLabel("Qué querés contar").fill("Presento mi juego");
  await author.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(author.getByText(/Un «Nuevo juego» tiene que llevar el juego/)).toBeVisible();

  await author.getByLabel("Tipo de publicación").selectOption("avance");
  await author.getByLabel("Qué querés contar").fill("Este no se tiene que publicar");
  await author.getByLabel("Elegir archivos").setInputFiles({ name: "falso.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await author.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(author.getByText(/no es una imagen PNG, JPG o WebP, un GIF ni un video MP4 válido/)).toBeVisible();

  await author.getByRole("button", { name: "Quitar falso.png" }).click();
  await author.getByLabel("Elegir archivos").setInputFiles({ name: "disfrazado.png", mimeType: "image/png", buffer: FILES.gif.buffer });
  await author.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(author.getByText("El contenido de uno de los archivos no coincide con su tipo.")).toBeVisible();

  await author.getByRole("button", { name: "Quitar disfrazado.png" }).click();
  await author.getByLabel("Elegir archivos").setInputFiles({ name: "pegado.gif", mimeType: "image/gif", buffer: Buffer.concat([FILES.gif.buffer, FILES.png.buffer]) });
  await author.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(author.getByText(/no es una imagen PNG, JPG o WebP, un GIF ni un video MP4 válido/)).toBeVisible();

  await author.getByRole("button", { name: "Quitar pegado.gif" }).click();
  await author.getByLabel("Elegir archivos").setInputFiles(Array.from({ length: 5 }, (_, index) => ({ ...FILES.png, name: `captura-${index}.png` })));
  await expect(author.getByText("Podés adjuntar hasta 4 archivos.")).toBeVisible();
  await expect(author.getByRole("list", { name: "Archivos elegidos" }).getByRole("listitem")).toHaveCount(4);

  await openPostsTab(author);
  await expect(card(author, "Este no se tiene que publicar")).toHaveCount(0);
});

test("el servidor no acepta publicar desde otro sitio ni sin sesión", async ({ playwright }) => {
  const anonymous = await playwright.request.newContext({ baseURL: SITE });
  const form = { kind: "avance", body: "desde afuera" };
  expect((await anonymous.post("/api/posts", { multipart: form, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await anonymous.post("/api/posts", { multipart: form })).status()).toBe(403);
  const noSession = await anonymous.post("/api/posts", { multipart: form, headers: { origin: SITE } });
  expect(noSession.status()).toBe(401);
  expect(await noSession.json()).toMatchObject({ ok: false, error: "unauthenticated" });
  await anonymous.dispose();

  const withSession = await author.request.post("/api/posts", { multipart: { kind: "avance", body: "x", gameId: "00000000-0000-4000-8000-000000000000" }, headers: { origin: SITE } });
  expect(withSession.status()).toBe(422);
  expect(await withSession.json()).toMatchObject({ ok: false, error: "invalidGame" });
});

test("un avance de un juego propio se muestra en la página del juego, y no se puede ligar a juegos ajenos", async () => {
  await gotoReady(author, `/games/${publicId}`);
  await author.getByRole("link", { name: "Publicar un avance" }).click();
  await expect(author).toHaveURL(new RegExp(`/posts/new\\?game=${publicId}$`));
  await author.waitForLoadState("networkidle");
  const gameSelect = author.getByRole("combobox", { name: "Juego", exact: true });
  await expect(gameSelect).toHaveValue(/.+/);
  await expect(gameSelect.locator("option")).toHaveText(["Ninguno (un avance general)", "Juego de avances"]);

  await author.getByLabel("Tipo de publicación").selectOption("hito");
  await author.getByLabel("Dato destacado").fill("100");
  await author.getByLabel("Qué querés contar").fill("100 personas jugaron");
  await author.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(author).toHaveURL(new RegExp(`/games/${publicId}$`), { timeout: 30_000 });
  const published = card(author, "100 personas jugaron");
  await expect(published).toBeVisible();
  await expect(published.getByText("Hito")).toBeVisible();
  await expect(published.getByText("100", { exact: true })).toBeVisible();

  const stolen = await author.request.post("/api/posts", { multipart: { kind: "avance", body: "x", gameId: "11111111-1111-4111-8111-111111111111" }, headers: { origin: SITE } });
  expect(await stolen.json()).toMatchObject({ ok: false, error: "invalidGame" });
});

test("otra persona no ve las opciones de un avance ajeno ni puede abrir su edición", async ({ browser }, testInfo) => {
  await openPostsTab(author);
  const mine = card(author, "Probé el nivel 2 con salto doble.");
  await mine.getByRole("button", { name: "Opciones del avance" }).click();
  const link = author.getByRole("menuitem", { name: "Editar" });
  const href = (await link.getAttribute("href")) ?? "";
  expect(href).toMatch(/\/posts\/[0-9a-f-]{36}\/edit$/);
  await author.keyboard.press("Escape");

  const other = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(other, "valen@trafal.test", "trafal123");
  await gotoReady(other, `/u/${username}`);
  await other.getByRole("tab", { name: "Avances" }).click();
  await expect(card(other, "Probé el nivel 2 con salto doble.")).toBeVisible();
  await expect(other.getByRole("button", { name: "Opciones del avance" })).toHaveCount(0);
  await other.goto(href);
  await expect(other.getByText("No encontramos esa página")).toBeVisible();
  await expect(other.getByLabel("Qué querés contar")).toHaveCount(0);
  await expect(other.getByText("Probé el nivel 2 con salto doble.")).toHaveCount(0);
  await other.context().close();
});

test("el autor edita todo: tipo, juego, texto y archivos (quitar, agregar, reordenar y describir)", async () => {
  await openPostsTab(author);
  const mine = card(author, "Probé el nivel 2 con salto doble.");
  const oldImageUrl = (await mine.getByRole("img", { name: "Captura del nivel 2" }).getAttribute("src")) ?? "";
  const oldGifUrl = (await mine.getByRole("img", { name: "GIF del avance" }).getAttribute("src")) ?? "";

  await mine.getByRole("button", { name: "Opciones del avance" }).click();
  await author.getByRole("menuitem", { name: "Editar" }).click();
  await expect(author.getByRole("heading", { level: 1, name: "Editar avance" })).toBeVisible();
  await author.waitForLoadState("networkidle");

  await expect(author.getByLabel("Qué querés contar")).toHaveValue("Probé el nivel 2 con salto doble.");
  const files = author.getByRole("list", { name: "Archivos elegidos" });
  await expect(files.getByRole("listitem")).toHaveCount(3);
  await expect(files.getByText("Archivo actual")).toHaveCount(3);

  await author.getByLabel("Tipo de publicación").selectOption("pide_feedback");
  await author.getByRole("combobox", { name: "Juego", exact: true }).selectOption({ label: "Juego de avances" });
  await author.getByLabel("Qué querés contar").fill("Texto nuevo: ¿se entiende el nivel 2?");

  await author.getByRole("button", { name: "Quitar Archivo 2" }).click();
  await expect(files.getByRole("listitem")).toHaveCount(2);
  await author.getByLabel("Elegir archivos").setInputFiles({ name: "nivel-3.png", mimeType: "image/png", buffer: makePng(80, 60, { color: [255, 120, 60] }) });
  await expect(files.getByRole("listitem")).toHaveCount(3);
  await author.getByLabel("Descripción de nivel-3.png (opcional)").fill("Captura del nivel 3");
  await author.getByLabel("Descripción de Captura del nivel 2 (opcional)").fill("Nivel 2, con el salto doble");
  await author.getByRole("button", { name: "Mover nivel-3.png antes" }).click();
  await author.getByRole("button", { name: "Mover nivel-3.png antes" }).click();
  await author.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(author).toHaveURL(new RegExp(`/games/${publicId}$`), { timeout: 30_000 });
  const edited = card(author, "Texto nuevo: ¿se entiende el nivel 2?");
  await expect(edited).toBeVisible();
  await expect(edited.getByText("Pide feedback")).toBeVisible();
  const media = edited.getByRole("list", { name: "Archivos del avance" }).getByRole("listitem");
  await expect(media).toHaveCount(3);
  await expect(media.nth(0).getByRole("img", { name: "Captura del nivel 3" })).toBeVisible();
  await expect(media.nth(1).getByRole("img", { name: "Nivel 2, con el salto doble" })).toBeVisible();
  await expect(media.nth(2).locator("video")).toHaveCount(1);
  await expect(edited.getByRole("img", { name: "GIF del avance" })).toHaveCount(0);

  const keptUrl = (await media.nth(1).getByRole("img").getAttribute("src")) ?? "";
  expect(keptUrl).toBe(oldImageUrl);
  expect((await author.request.get(keptUrl)).status()).toBe(200);
  const addedUrl = (await media.nth(0).getByRole("img").getAttribute("src")) ?? "";
  expect((await author.request.get(addedUrl)).status()).toBe(200);
  await expect.poll(async () => (await author.request.get(oldGifUrl)).status(), { timeout: 15_000 }).toBeGreaterThanOrEqual(400);

  await edited.getByRole("button", { name: "Opciones del avance" }).click();
  await author.getByRole("menuitem", { name: "Editar" }).click();
  await author.waitForLoadState("networkidle");
  await expect(author.getByRole("combobox", { name: "Juego", exact: true })).not.toHaveValue("");
  await author.getByRole("combobox", { name: "Juego", exact: true }).selectOption("");
  for (const name of ["Captura del nivel 3", "Nivel 2, con el salto doble", "Archivo 3"]) await author.getByRole("button", { name: `Quitar ${name}` }).click();
  await author.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(author).toHaveURL(new RegExp(`/u/${username}$`), { timeout: 30_000 });
  await author.getByRole("tab", { name: "Avances" }).click();
  const bare = card(author, "Texto nuevo: ¿se entiende el nivel 2?");
  await expect(bare).toBeVisible();
  await expect(bare.getByRole("list", { name: "Archivos del avance" })).toHaveCount(0);
  await expect.poll(async () => (await author.request.get(keptUrl)).status(), { timeout: 15_000 }).toBeGreaterThanOrEqual(400);
  await expect.poll(async () => (await author.request.get(addedUrl)).status(), { timeout: 15_000 }).toBeGreaterThanOrEqual(400);
});

test("el servidor rechaza una edición con una lista de archivos que no es la del avance", async () => {
  await openPostsTab(author);
  await card(author, "Texto nuevo: ¿se entiende el nivel 2?").getByRole("button", { name: "Opciones del avance" }).click();
  const href = (await author.getByRole("menuitem", { name: "Editar" }).getAttribute("href")) ?? "";
  const postId = /posts\/([0-9a-f-]{36})\/edit/.exec(href)?.[1] ?? "";
  expect(postId).not.toBe("");
  await author.keyboard.press("Escape");

  const send = (multipart: Record<string, string>, headers: Record<string, string> = { origin: SITE }) => author.request.put(`/api/posts/${postId}`, { multipart, headers });
  const base = { kind: "avance", body: "x" };
  expect(await (await send({ ...base, media: JSON.stringify([{ type: "keep", id: "11111111-1111-4111-8111-111111111111", alt: "" }]) })).json()).toMatchObject({ error: "invalidMedia" });
  expect(await (await send({ ...base, media: JSON.stringify([{ type: "new", index: 0, alt: "" }]) })).json()).toMatchObject({ error: "invalidMedia" });
  expect(await (await send({ ...base, media: "esto no es json" })).json()).toMatchObject({ error: "invalidMedia" });
  expect((await send(base, {})).status()).toBe(403);
  expect((await author.request.put("/api/posts/00000000-0000-4000-8000-000000000000", { multipart: base, headers: { origin: SITE } })).status()).toBe(404);
});

test("el autor borra su avance con sus archivos", async () => {
  await openPostsTab(author);
  await card(author, "Texto nuevo: ¿se entiende el nivel 2?").getByRole("button", { name: "Opciones del avance" }).click();
  await author.getByRole("menuitem", { name: "Editar" }).click();
  await author.waitForLoadState("networkidle");
  await author.getByLabel("Elegir archivos").setInputFiles({ ...FILES.png, name: "ultima.png" });
  await author.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(author).toHaveURL(new RegExp(`/u/${username}$`), { timeout: 30_000 });
  await author.getByRole("tab", { name: "Avances" }).click();
  const withFile = card(author, "Texto nuevo: ¿se entiende el nivel 2?");
  const url = (await withFile.getByRole("img").first().getAttribute("src")) ?? "";
  expect((await author.request.get(url)).status()).toBe(200);

  await withFile.getByRole("button", { name: "Opciones del avance" }).click();
  await author.getByRole("menuitem", { name: "Eliminar" }).click();
  await author.getByRole("dialog", { name: "¿Eliminar este avance?" }).getByRole("button", { name: "Eliminar" }).click();
  await expect(card(author, "Texto nuevo: ¿se entiende el nivel 2?")).toHaveCount(0);
  await expect.poll(async () => (await author.request.get(url)).status(), { timeout: 15_000 }).toBeGreaterThanOrEqual(400);
});
