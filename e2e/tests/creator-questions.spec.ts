import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { uploadGameZip, unpublishGame } from "./helpers/game";
import { lettersOnly, registerAccount, uniqueSuffix, gotoReady } from "./helpers/session";
import { playableGameZip } from "./helpers/zip";

/**
 * The questions a creator asks about a game, the answers people give, and the creator marking the ones that helped («Me sirvió»).
 * One account publishes a game with two questions, another answers. Needs the whole stack running (./start.sh), the worker included.
 */
test.describe.configure({ mode: "serial" });

let creatorContext: BrowserContext;
let answererContext: BrowserContext;
let creator: Page;
let answerer: Page;
let publicId = "";
let tag = "";

const question = (n: number) => `Pregunta ${n} del creador [${tag}]`;
const say = (text: string) => `${text} [${tag}]`;

function comment(page: Page, text: string) {
  return page.locator("article").filter({ visible: true }).filter({ hasText: text });
}

function questionBlock(page: Page, n: number) {
  return page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3, name: question(n) }) }).filter({ visible: true });
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  tag = uniqueSuffix(testInfo.project.name);
  creatorContext = await browser.newContext({ ...testInfo.project.use });
  answererContext = await browser.newContext({ ...testInfo.project.use });
  creator = await creatorContext.newPage();
  answerer = await answererContext.newPage();

  await registerAccount(answerer, { email: `e2e_answerer_${tag}@trafal.test`, username: `answerer_${lettersOnly(tag)}`, displayName: "Persona Respuestas" });
  await registerAccount(creator, { email: `e2e_asker_${tag}@trafal.test`, username: `asker_${lettersOnly(tag)}`, displayName: "Persona Preguntas" });
  await uploadGameZip(creator, "Juego con preguntas", playableGameZip(), "game.zip", [question(1), question(2)]);
  await expect(creator.getByText("Lista", { exact: true })).toBeVisible({ timeout: 45_000 });
  await creator.getByRole("button", { name: "Publicar juego" }).click();
  await expect(creator.getByText("Tu juego está publicado")).toBeVisible();
  publicId = /\/games\/([a-z0-9]+)\/manage$/.exec(creator.url())?.[1] ?? "";
  expect(publicId).not.toBe("");
});

test.afterAll(async () => {
  try {
    if (publicId) await unpublishGame(creator, publicId);
  } finally {
    await creatorContext?.close();
    await answererContext?.close();
  }
});

test("las preguntas del creador son públicas; quien no tiene sesión es invitado a iniciar sesión para responder", async ({ browser }, testInfo) => {
  const visitor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await gotoReady(visitor, `/games/${publicId}`);
  await expect(visitor.getByRole("heading", { level: 2, name: "Preguntas del creador" })).toBeVisible();
  await expect(questionBlock(visitor, 1)).toContainText("Sin respuestas todavía");
  await expect(questionBlock(visitor, 2)).toBeVisible();
  await expect(questionBlock(visitor, 1).getByRole("link", { name: "Iniciá sesión para comentar" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/games/${publicId}`)}`);
  await visitor.context().close();
});

test("el creador no responde sus propias preguntas", async () => {
  await gotoReady(creator, `/games/${publicId}`);
  await expect(creator.getByText("Estas son tus preguntas")).toBeVisible();
  await expect(questionBlock(creator, 1).getByRole("button", { name: "Responder la pregunta" })).toHaveCount(0);
});

test("una persona responde una pregunta una sola vez y puede editar su respuesta", async () => {
  await gotoReady(answerer, `/games/${publicId}`);
  const first = questionBlock(answerer, 1);
  await first.getByLabel("Tu respuesta").fill(say("Sí, se entiende el objetivo."));
  await first.getByRole("button", { name: "Responder la pregunta" }).click();

  await expect(comment(answerer, say("Sí, se entiende el objetivo."))).toHaveCount(1);
  await expect(first).toContainText("1 respuesta");
  await expect(first.getByText("Ya respondiste esta pregunta")).toBeVisible();
  await expect(first.getByRole("button", { name: "Responder la pregunta" })).toHaveCount(0);
  await expect(questionBlock(answerer, 2).getByRole("button", { name: "Responder la pregunta" })).toBeVisible();

  await comment(answerer, say("Sí, se entiende el objetivo.")).getByRole("button", { name: "Editar" }).click();
  const dialog = answerer.getByRole("dialog", { name: "Editar comentario" });
  await dialog.getByLabel("Tu comentario").fill(say("Sí, el objetivo se entiende de entrada."));
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(comment(answerer, say("Sí, el objetivo se entiende de entrada."))).toHaveCount(1);
  await expect(comment(answerer, say("Sí, se entiende el objetivo."))).toHaveCount(0);
});

test("las respuestas a las preguntas no se mezclan con los comentarios generales", async () => {
  await gotoReady(answerer, `/games/${publicId}`);
  await answerer.getByLabel("Tu comentario").first().fill(say("Un comentario general del juego."));
  await answerer.getByRole("button", { name: "Comentar" }).first().click();
  await expect(comment(answerer, say("Un comentario general del juego."))).toHaveCount(1);

  const comments = answerer.getByRole("region", { name: "Comentarios" });
  await expect(comments.getByText(say("Un comentario general del juego."))).toBeVisible();
  await expect(comments.getByText(say("Sí, el objetivo se entiende de entrada."))).toHaveCount(0);
  await expect(questionBlock(answerer, 1).getByText(say("Sí, el objetivo se entiende de entrada."))).toBeVisible();
});

test("el creador marca «Me sirvió» en una respuesta y en un comentario, y lo puede quitar", async () => {
  await gotoReady(creator, `/games/${publicId}`);
  const answer = comment(creator, say("Sí, el objetivo se entiende de entrada."));
  await expect(answer.getByText("Le sirvió al creador")).toHaveCount(0);
  const mark = answer.getByRole("button", { name: "Me sirvió" });
  await mark.click();
  await expect(answer.getByText("Le sirvió al creador")).toBeVisible();
  await expect(answer.getByRole("button", { name: "Marcado: me sirvió" })).toHaveAttribute("aria-pressed", "true");

  await gotoReady(creator, `/games/${publicId}`);
  await expect(comment(creator, say("Sí, el objetivo se entiende de entrada.")).getByText("Le sirvió al creador")).toBeVisible();

  const general = comment(creator, say("Un comentario general del juego."));
  await general.getByRole("button", { name: "Me sirvió" }).click();
  await expect(general.getByText("Le sirvió al creador")).toBeVisible();

  await comment(creator, say("Sí, el objetivo se entiende de entrada.")).getByRole("button", { name: "Marcado: me sirvió" }).click();
  await expect(comment(creator, say("Sí, el objetivo se entiende de entrada.")).getByText("Le sirvió al creador")).toHaveCount(0);
});

test("solo el creador ve «Me sirvió»: ni quien comentó, ni sobre una respuesta ni sobre lo propio", async () => {
  await gotoReady(answerer, `/games/${publicId}`);
  await expect(comment(answerer, say("Un comentario general del juego."))).toHaveCount(1);
  await expect(answerer.getByRole("button", { name: /Me sirvió|Marcado: me sirvió/ })).toHaveCount(0);

  await gotoReady(creator, `/games/${publicId}`);
  await creator.getByLabel("Tu comentario").first().fill(say("Gracias por jugar."));
  await creator.getByRole("button", { name: "Comentar" }).first().click();
  await expect(comment(creator, say("Gracias por jugar."))).toHaveCount(1);
  await expect(comment(creator, say("Gracias por jugar.")).getByRole("button", { name: /Me sirvió/ })).toHaveCount(0);

  const general = comment(creator, say("Un comentario general del juego."));
  await general.getByRole("button", { name: "Responder" }).click();
  await general.getByLabel(/Respuesta para/).fill(say("Gracias por el comentario."));
  await general.getByRole("button", { name: "Responder", exact: true }).last().click();
  await expect(comment(creator, say("Gracias por el comentario."))).toHaveCount(1);
  await expect(comment(creator, say("Gracias por el comentario.")).getByRole("button", { name: /Me sirvió/ })).toHaveCount(0);
});
