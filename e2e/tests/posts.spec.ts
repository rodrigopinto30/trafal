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
  return page.locator("article").filter({ hasText: text });
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

test("el autor edita el texto de su avance y lo borra con sus archivos; otra persona no ve esas opciones", async ({ browser }, testInfo) => {
  await openPostsTab(author);
  const mine = card(author, "Probé el nivel 2 con salto doble.");
  const imageUrl = (await mine.getByRole("img", { name: "Captura del nivel 2" }).getAttribute("src")) ?? "";

  const other = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(other, "valen@trafal.test", "trafal123");
  await gotoReady(other, `/u/${username}`);
  await other.getByRole("tab", { name: "Avances" }).click();
  await expect(card(other, "Probé el nivel 2 con salto doble.")).toBeVisible();
  await expect(other.getByRole("button", { name: "Opciones del avance" })).toHaveCount(0);
  await other.context().close();

  await mine.getByRole("button", { name: "Opciones del avance" }).click();
  await author.getByRole("menuitem", { name: "Editar" }).click();
  const dialog = author.getByRole("dialog", { name: "Editar avance" });
  await dialog.getByLabel("Qué querés contar").fill("Texto corregido del nivel 2.");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(author.getByRole("dialog")).toHaveCount(0);
  await expect(card(author, "Texto corregido del nivel 2.")).toBeVisible();
  await expect(card(author, "Texto corregido del nivel 2.").getByRole("img", { name: "Captura del nivel 2" })).toBeVisible();

  await card(author, "Texto corregido del nivel 2.").getByRole("button", { name: "Opciones del avance" }).click();
  await author.getByRole("menuitem", { name: "Eliminar" }).click();
  const confirm = author.getByRole("dialog", { name: "¿Eliminar este avance?" });
  await confirm.getByRole("button", { name: "Eliminar" }).click();
  await expect(card(author, "Texto corregido del nivel 2.")).toHaveCount(0);

  await expect.poll(async () => (await author.request.get(imageUrl)).status(), { timeout: 15_000 }).toBeGreaterThanOrEqual(400);
});
