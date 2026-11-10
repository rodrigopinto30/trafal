import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, deleteRows, gameIdOf, insertRow, userIdOf } from "./helpers/supabase";

/**
 * Usage limits: the database counts what each person does (here, comments: 8 a minute) and refuses the rest, whoever asks and
 * however (the test fills the limit through the API and then tries it from the page). It affects only that person, and admins
 * are not limited. Everything the test writes goes with the account or is deleted.
 */
test.describe.configure({ mode: "serial" });

const GAME = "/games/orbita";
const PASSWORD = "Trafal12345";
const LIMIT = 8;

let page: Page;
let suffix = "";
let email = "";
let token = "";
let gameId = "";

const commentRow = (authorId: string, text: string) => ({ author_id: authorId, game_id: gameId, body: text });

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  suffix = uniqueSuffix(testInfo.project.name);
  email = `e2e_limits_${suffix}@trafal.test`;
  page = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await registerAccount(page, { email, username: `limits_${lettersOnly(suffix)}`, displayName: "Persona Límites", password: PASSWORD });
  token = await accessTokenOf(email, PASSWORD);
  gameId = await gameIdOf("orbita");
});

test.afterAll(async () => {
  await deleteRows("comments", `body=like.${encodeURIComponent(`Comentario de admin ${suffix}%`)}`, await accessTokenOf("admin@trafal.test", "trafal123"));
  await page?.context().close();
});

test("la base acepta 8 comentarios en un minuto y rechaza el siguiente, diciendo cuánto esperar", async () => {
  const author = userIdOf(token);
  for (let n = 1; n <= LIMIT; n++) expect((await insertRow("comments", commentRow(author, `Comentario ${n} ${suffix}`), token)).status).toBe(201);

  const refused = await insertRow("comments", commentRow(author, `Comentario de más ${suffix}`), token);
  expect(refused.status).toBe(400);
  expect(refused.body).toMatchObject({ message: "usage_limit_exceeded", details: "comment" });
  expect(Number(refused.body?.hint)).toBeGreaterThan(0);
  expect(Number(refused.body?.hint)).toBeLessThanOrEqual(60);
});

test("desde la página se ve un mensaje claro y no se agrega nada", async () => {
  await gotoReady(page, GAME);
  await page.getByLabel("Tu comentario").first().fill(`Otro comentario ${suffix}`);
  await page.getByRole("button", { name: "Comentar" }).first().click();
  await expect(page.getByText("Estás comentando muy seguido. Esperá un momento y probá de nuevo.")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: `Otro comentario ${suffix}` })).toHaveCount(0);
});

test("el tope es de cada persona: otra cuenta puede comentar", async ({ browser }, testInfo) => {
  const other = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  const otherSuffix = `${suffix}b`;
  await registerAccount(other, { email: `e2e_limits_${otherSuffix}@trafal.test`, username: `limitsb_${lettersOnly(suffix)}`, displayName: "Otra Persona", password: PASSWORD });
  await gotoReady(other, GAME);
  await other.getByLabel("Tu comentario").first().fill(`Comentario ajeno ${suffix}`);
  await other.getByRole("button", { name: "Comentar" }).first().click();
  await expect(other.locator("article").filter({ hasText: `Comentario ajeno ${suffix}` })).toHaveCount(1);
  await other.context().close();
});

test("la administración no tiene tope", async () => {
  const adminToken = await accessTokenOf("admin@trafal.test", "trafal123");
  const admin = userIdOf(adminToken);
  for (let n = 1; n <= LIMIT + 4; n++) expect((await insertRow("comments", commentRow(admin, `Comentario de admin ${suffix} ${n}`), adminToken)).status).toBe(201);
});
