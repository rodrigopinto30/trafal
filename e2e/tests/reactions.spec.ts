import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";

/** Likes and saves on a game and on an update, the «Saved» page and what a visitor sees. One new account does everything. */
test.describe.configure({ mode: "serial" });

const GAME = "/games/orbita";
const POST_TEXT = "Probando un planeta con anillos";

let page: Page;

async function likeCount(button: ReturnType<Page["getByRole"]>): Promise<number> {
  return Number(/\d+/.exec((await button.textContent()) ?? "")?.[0] ?? "NaN");
}

function postCard(target: Page) {
  return target.locator("article").filter({ hasText: POST_TEXT });
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ ...testInfo.project.use });
  page = await context.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(page, { email: `e2e_reactions_${suffix}@trafal.test`, username: `reactions_${lettersOnly(suffix)}`, displayName: "Persona Reacciones" });
});

test.afterAll(async () => {
  await page?.context().close();
});

test("una persona sin cuenta ve los botones pero la llevan a iniciar sesión y volver", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await gotoReady(visitor, GAME);
  await expect(visitor.getByRole("link", { name: /^Me gusta/ }).first()).toHaveAttribute("href", `/login?next=${encodeURIComponent(GAME)}`);
  await expect(visitor.getByRole("link", { name: "Guardar" }).first()).toHaveAttribute("href", `/login?next=${encodeURIComponent(GAME)}`);
  await visitor.getByRole("link", { name: /^Me gusta/ }).first().click();
  await expect(visitor).toHaveURL(/\/login\?next=%2Fgames%2Forbita$/);
  await context.close();
});

test("me gusta en un juego: sube el contador, queda al recargar y se puede sacar", async () => {
  await gotoReady(page, GAME);
  const like = page.getByRole("button", { name: /^Me gusta/ }).first();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  const before = await likeCount(like);

  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => likeCount(like)).toBe(before + 1);
  await expect(like).toBeEnabled();

  await gotoReady(page, GAME);
  const reloaded = page.getByRole("button", { name: /^Me gusta/ }).first();
  await expect(reloaded).toHaveAttribute("aria-pressed", "true");
  expect(await likeCount(reloaded)).toBe(before + 1);

  await reloaded.click();
  await expect(reloaded).toHaveAttribute("aria-pressed", "false");
  await expect(reloaded).toBeEnabled();
  await expect.poll(() => likeCount(reloaded)).toBe(before);
});

test("guardar un juego y un avance: aparecen en «Guardados» y salen al quitarlos", async () => {
  await gotoReady(page, GAME);
  const saveGame = page.getByRole("button", { name: "Guardar" }).first();
  await saveGame.click();
  await expect(saveGame).toHaveAttribute("aria-pressed", "true");
  await expect(saveGame).toBeEnabled();

  const savePost = postCard(page).getByRole("button", { name: "Guardar" });
  await savePost.click();
  await expect(savePost).toHaveAttribute("aria-pressed", "true");
  await expect(savePost).toBeEnabled();

  await gotoReady(page, "/saved");
  await expect(page.getByRole("heading", { level: 1, name: "Guardados" })).toBeVisible();
  const games = page.getByRole("region", { name: "Juegos" });
  await expect(games.getByRole("heading", { name: "Órbita" })).toBeVisible();
  const posts = page.getByRole("region", { name: "Avances" });
  await expect(posts.getByText(POST_TEXT)).toBeVisible();

  await posts.getByRole("button", { name: "Guardar" }).first().click();
  await expect(posts.getByRole("button", { name: "Guardar" }).first()).toHaveAttribute("aria-pressed", "false");
  await expect(posts.getByRole("button", { name: "Guardar" }).first()).toBeEnabled();

  await gotoReady(page, "/saved");
  await expect(page.getByRole("region", { name: "Avances" }).getByText("Todavía no guardaste ningún avance.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Juegos" }).getByRole("heading", { name: "Órbita" })).toBeVisible();

  await gotoReady(page, GAME);
  await page.getByRole("button", { name: "Guardar" }).first().click();
  await expect(page.getByRole("button", { name: "Guardar" }).first()).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Guardar" }).first()).toBeEnabled();
  await gotoReady(page, "/saved");
  await expect(page.getByRole("region", { name: "Juegos" }).getByText("Todavía no guardaste ningún juego.")).toBeVisible();
});

test("me gusta en un avance, desde la página del juego y desde el perfil de quien lo escribió", async () => {
  await gotoReady(page, GAME);
  const card = postCard(page);
  const like = card.getByRole("button", { name: /^Me gusta/ });
  const before = await likeCount(like);
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => likeCount(like)).toBe(before + 1);
  await expect(like).toBeEnabled();

  await gotoReady(page, "/u/sofi_pixels");
  await page.getByRole("tab", { name: "Avances" }).click();
  const sameOnProfile = postCard(page).getByRole("button", { name: /^Me gusta/ });
  await expect(sameOnProfile).toHaveAttribute("aria-pressed", "true");
  await sameOnProfile.click();
  await expect(sameOnProfile).toHaveAttribute("aria-pressed", "false");
  await expect(sameOnProfile).toBeEnabled();
  await expect.poll(() => likeCount(sameOnProfile)).toBe(before);
});

test("«Guardados» está en el menú de la cuenta y exige sesión", async ({ browser }, testInfo) => {
  await gotoReady(page, "/");
  const account = page.getByRole("button", { name: "Tu cuenta" });
  const burger = page.getByRole("button", { name: "Abrir menú" });
  await expect(account.or(burger).first()).toBeVisible();
  await expect(async () => {
    const entry = page.getByRole("menuitem", { name: "Guardados" }).or(page.getByRole("link", { name: "Guardados" }));
    if (!(await entry.isVisible())) await (await account.isVisible() ? account : burger).click();
    await entry.click({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/saved$/);

  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto("/saved");
  await expect(visitor).toHaveURL(/\/login\?next=%2Fsaved/);
  await context.close();
});
