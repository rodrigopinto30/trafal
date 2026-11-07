import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";

/**
 * Commenting on a game and on an update, replying (one level), editing and deleting your own comments, and what other people
 * can and cannot do. One new account writes everything, on the seeded game «Órbita» and its seeded update; the account's
 * comments go with it when the run cleans up.
 */
test.describe.configure({ mode: "serial" });

const GAME = "/games/orbita";
const SEEDED_COMMENT = "Me encantó usar la gravedad de las estrellas";
const POST_TEXT = "Probando un planeta con anillos";

let context: BrowserContext;
let writer: Page;
let tag = "";

function say(text: string): string {
  return `${text} [${tag}]`;
}

function comment(page: Page, text: string) {
  return page.locator("article").filter({ visible: true }).filter({ hasText: text });
}

async function expectCommentCount(page: Page, count: string) {
  await expect(async () => {
    await gotoReady(page, GAME);
    const card = page.locator("article").filter({ visible: true }).filter({ hasText: POST_TEXT });
    await expect(card.getByRole("link", { name: /comentario/ })).toContainText(count, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

async function openPostPage(page: Page) {
  await gotoReady(page, GAME);
  const card = page.locator("article").filter({ visible: true }).filter({ hasText: POST_TEXT });
  await card.getByRole("link", { name: /comentario/ }).click();
  await expect(page).toHaveURL(/\/posts\/[0-9a-f-]{36}(#comments)?$/);
  await page.waitForLoadState("networkidle");
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  context = await browser.newContext({ ...testInfo.project.use });
  writer = await context.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  tag = suffix;
  await registerAccount(writer, { email: `e2e_comments_${suffix}@trafal.test`, username: `comments_${lettersOnly(suffix)}`, displayName: "Persona Comentarios" });
});

test.afterAll(async () => {
  await context?.close();
});

test("quien no tiene sesión ve la lista y una invitación a iniciar sesión, no el formulario", async ({ browser }, testInfo) => {
  const visitor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await gotoReady(visitor, GAME);
  await expect(visitor.getByText(SEEDED_COMMENT)).toBeVisible();
  await expect(visitor.getByLabel("Tu comentario")).toHaveCount(0);
  const login = visitor.getByRole("link", { name: "Iniciá sesión para comentar" });
  await expect(login).toHaveAttribute("href", `/login?next=${encodeURIComponent(GAME)}`);
  await comment(visitor, SEEDED_COMMENT).getByRole("button", { name: "Responder" }).click();
  await expect(comment(visitor, SEEDED_COMMENT).getByRole("link", { name: "Iniciá sesión para responder" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(GAME)}`);
  await visitor.context().close();
});

test("se comenta un juego con una etiqueta y aparece arriba, con el formulario limpio", async () => {
  await gotoReady(writer, GAME);
  const form = writer.getByLabel("Tu comentario").first();
  await writer.getByRole("button", { name: "Comentar" }).first().click();
  await expect(writer.getByText("Escribí algo para comentar.")).toBeVisible();

  await form.fill("x".repeat(1001));
  await writer.getByRole("button", { name: "Comentar" }).first().click();
  await expect(writer.getByText("El comentario es demasiado largo (hasta 1000 caracteres).")).toBeVisible();

  await form.fill(say("El segundo nivel se siente muy bien."));
  await writer.getByLabel("Tipo de comentario").first().selectOption("suggestion");
  await writer.getByRole("button", { name: "Comentar" }).first().click();

  const mine = comment(writer, say("El segundo nivel se siente muy bien."));
  await expect(mine).toHaveCount(1);
  await expect(mine.getByText("Sugerencia")).toBeVisible();
  await expect(form).toHaveValue("");
  await expect(writer.getByLabel("Tipo de comentario").first()).toHaveValue("");
  await gotoReady(writer, GAME);
  await expect(comment(writer, say("El segundo nivel se siente muy bien."))).toHaveCount(1);
});

test("se responde a un comentario ajeno, en un solo nivel y sin etiqueta", async () => {
  await gotoReady(writer, GAME);
  const seeded = comment(writer, SEEDED_COMMENT);
  await seeded.getByRole("button", { name: "Responder" }).click();
  await expect(seeded.getByLabel("Tipo de comentario")).toHaveCount(0);
  await seeded.getByLabel(/Respuesta para/).fill(say("Coincido, la gravedad es lo mejor."));
  await seeded.getByRole("button", { name: "Responder", exact: true }).last().click();
  await expect(comment(writer, say("Coincido, la gravedad es lo mejor."))).toHaveCount(1);
  await expect(comment(writer, say("Coincido, la gravedad es lo mejor.")).getByRole("button", { name: "Responder", exact: true })).toHaveCount(0);
});

test("se edita el texto y la etiqueta de un comentario propio, y se borra con confirmación", async () => {
  await gotoReady(writer, GAME);
  const mine = comment(writer, say("El segundo nivel se siente muy bien."));
  await mine.getByRole("button", { name: "Editar" }).click();
  const dialog = writer.getByRole("dialog", { name: "Editar comentario" });
  await dialog.getByLabel("Tu comentario").fill(say("El segundo nivel se siente genial."));
  await dialog.getByLabel("Tipo de comentario").selectOption("liked");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(writer.getByRole("dialog")).toHaveCount(0);
  const edited = comment(writer, say("El segundo nivel se siente genial."));
  await expect(edited).toHaveCount(1);
  await expect(edited.getByText("Me gustó")).toBeVisible();
  await expect(comment(writer, say("El segundo nivel se siente muy bien."))).toHaveCount(0);

  await comment(writer, say("Coincido, la gravedad es lo mejor.")).getByRole("button", { name: "Eliminar" }).click();
  await writer.getByRole("dialog", { name: "¿Eliminar este comentario?" }).getByRole("button", { name: "Eliminar" }).click();
  await expect(comment(writer, say("Coincido, la gravedad es lo mejor."))).toHaveCount(0);
  await expect(comment(writer, SEEDED_COMMENT)).toBeVisible();
});

test("otra persona puede responder pero no editar ni borrar lo ajeno", async ({ browser }, testInfo) => {
  const other = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(other, "valen@trafal.test", "trafal123");
  await gotoReady(other, GAME);
  const theirs = comment(other, say("El segundo nivel se siente genial."));
  await expect(theirs).toHaveCount(1);
  await expect(theirs.getByRole("button", { name: "Responder" })).toBeVisible();
  await expect(theirs.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(theirs.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  await other.context().close();
});

test("en la página de un avance: comentar, responder, contar y borrar", async () => {
  await openPostPage(writer);
  await expect(writer.getByRole("heading", { level: 2, name: "Comentarios" })).toBeVisible();
  const form = writer.getByLabel("Tu comentario").first();
  await form.fill(say("Se ve increíble el planeta con anillos."));
  await writer.getByRole("button", { name: "Comentar" }).first().click();
  const mine = comment(writer, say("Se ve increíble el planeta con anillos."));
  await expect(mine).toHaveCount(1);

  await mine.getByRole("button", { name: "Responder" }).click();
  await mine.getByLabel(/Respuesta para/).fill(say("Y eso que es un prototipo."));
  await mine.getByRole("button", { name: "Responder", exact: true }).last().click();
  await expect(comment(writer, say("Y eso que es un prototipo."))).toHaveCount(1);

  await expectCommentCount(writer, "2");

  await openPostPage(writer);
  await comment(writer, say("Se ve increíble el planeta con anillos.")).getByRole("button", { name: "Eliminar" }).click();
  await writer.getByRole("dialog", { name: "¿Eliminar este comentario?" }).getByRole("button", { name: "Eliminar" }).click();
  await expect(comment(writer, say("Se ve increíble el planeta con anillos."))).toHaveCount(0);
  await expect(comment(writer, say("Y eso que es un prototipo."))).toHaveCount(0);

  await expectCommentCount(writer, "0");
});
