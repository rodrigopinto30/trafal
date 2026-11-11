import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, deleteNotificationsSince } from "./helpers/supabase";

/**
 * The bell and the notifications page. A new account comments on, likes and follows the creator of the seeded game «Órbita»
 * (the example creator sofi); the creator sees it in her bell, opens it (it becomes read), reads and dismisses, and nobody else
 * can touch her notifications. The test dismisses what it caused when it ends.
 */
test.describe.configure({ mode: "serial" });

const GAME = "/games/orbita";
const CREATOR = { email: "sofi@trafal.test", password: "trafal123", username: "sofi_pixels" };

let actor: Page;
let creator: Page;
let suffix = "";
let since = "";
const actorName = "Persona Avisos";

const bell = (page: Page) => page.getByRole("link", { name: /^Notificaciones/ }).first();
const item = (page: Page, text: string | RegExp) => page.locator("article").filter({ hasText: text });

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  since = new Date().toISOString();
  suffix = uniqueSuffix(testInfo.project.name);
  actor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await registerAccount(actor, { email: `e2e_notifications_${suffix}@trafal.test`, username: `notifications_${lettersOnly(suffix)}`, displayName: actorName });
  creator = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(creator, CREATOR.email, CREATOR.password);
});

test.afterAll(async () => {
  await deleteNotificationsSince(await accessTokenOf(CREATOR.email, CREATOR.password), since);
  await actor?.context().close();
  await creator?.context().close();
});

test("quien no tiene sesión no ve la campanita y la página lo lleva a iniciar sesión", async ({ browser }, testInfo) => {
  const visitor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await gotoReady(visitor, "/");
  await expect(bell(visitor)).toHaveCount(0);
  await visitor.goto("/notifications");
  await expect(visitor).toHaveURL(/\/login\?next=%2Fnotifications/);
  await visitor.context().close();
});

test("la campanita se actualiza sola cuando llega un aviso", async () => {
  await gotoReady(creator, "/explore");
  await expect(bell(creator)).toBeVisible();
  const before = Number(/(\d+) sin leer/.exec((await bell(creator).getAttribute("aria-label")) ?? "")?.[1] ?? 0);

  await gotoReady(actor, GAME);
  await actor.getByLabel("Tu comentario").first().fill(`Qué lindo juego ${suffix}`);
  await actor.getByRole("button", { name: "Comentar" }).first().click();
  await expect(item(actor, `Qué lindo juego ${suffix}`).first()).toBeVisible();

  await expect(bell(creator)).toHaveAttribute("aria-label", `Notificaciones: ${before + 1} sin leer`, { timeout: 20_000 });
});

test("se avisa de un me gusta y de un seguidor, y cada aviso dice quién, qué y dónde", async () => {
  await gotoReady(actor, GAME);
  const like = actor.getByRole("button", { name: /^Me gusta/ }).first();
  await expect(like).toBeEnabled();
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toBeEnabled();
  await gotoReady(actor, `/u/${CREATOR.username}`);
  const follow = actor.getByRole("button", { name: /^Seguir/ });
  await expect(follow).toBeEnabled();
  await follow.click();
  await expect(actor.getByRole("button", { name: /^Dejar de seguir/ })).toBeEnabled();

  await gotoReady(creator, "/notifications");
  await expect(creator.getByRole("heading", { level: 1, name: "Notificaciones" })).toBeVisible();
  const comment = item(creator, `${actorName} comentó en Órbita`);
  await expect(comment).toBeVisible();
  await expect(comment.getByText(`Qué lindo juego ${suffix}`)).toBeVisible();
  await expect(comment.getByText("Sin leer")).toBeAttached();
  await expect(item(creator, `A ${actorName} le gustó Órbita`)).toBeVisible();
  await expect(item(creator, `${actorName} empezó a seguirte`)).toBeVisible();
});

test("abrir un aviso de comentario lleva al comentario, lo centra y lo resalta unos segundos", async () => {
  await gotoReady(creator, "/notifications");
  await item(creator, `${actorName} comentó en Órbita`).getByRole("link", { name: `${actorName} comentó en Órbita` }).click();
  await expect(creator).toHaveURL(/\/games\/orbita#comment-[0-9a-f-]{36}$/);

  const target = creator.locator('article[id^="comment-"]').filter({ hasText: `Qué lindo juego ${suffix}` });
  await expect(target).toHaveAttribute("data-highlighted", "true");
  await expect(target).toBeInViewport({ ratio: 1 });
  await expect(target).not.toHaveAttribute("data-highlighted", "true", { timeout: 10_000 });

  await gotoReady(creator, "/notifications");
  await expect(item(creator, `${actorName} comentó en Órbita`).getByText("Sin leer")).toHaveCount(0);
});

test("se marca como leído, se quita y se marcan todos", async () => {
  await gotoReady(creator, "/notifications");
  const like = item(creator, `A ${actorName} le gustó Órbita`);
  const markRead = like.getByRole("button", { name: "Marcar como leída" });
  await expect(markRead).toBeEnabled();
  await markRead.click();
  await expect(like.getByRole("button", { name: "Marcar como leída" })).toHaveCount(0);

  const follow = item(creator, `${actorName} empezó a seguirte`);
  const dismiss = follow.getByRole("button", { name: "Quitar" });
  await expect(dismiss).toBeEnabled();
  await dismiss.click();
  await expect(item(creator, `${actorName} empezó a seguirte`)).toHaveCount(0);

  await gotoReady(actor, GAME);
  await actor.getByLabel("Tu comentario").first().fill(`Otro comentario ${suffix}`);
  await actor.getByRole("button", { name: "Comentar" }).first().click();
  await expect(item(actor, `Otro comentario ${suffix}`).first()).toBeVisible();

  await gotoReady(creator, "/notifications");
  const all = creator.getByRole("button", { name: "Marcar todas como leídas" });
  await expect(all).toBeEnabled();
  await all.click();
  await expect(creator.getByText("Listo, marcaste todo como leído")).toBeVisible();
  await expect(creator.getByText("Sin leer")).toHaveCount(0);
  await expect(bell(creator)).toHaveAttribute("aria-label", "Notificaciones");
});

test("nadie puede abrir ni tocar los avisos de otra persona", async () => {
  await gotoReady(creator, "/notifications");
  const link = item(creator, `${actorName} comentó en Órbita`).getByRole("link").first();
  const id = /notifications\/([0-9a-f-]{36})/.exec((await link.getAttribute("href")) ?? "")?.[1] ?? "";
  expect(id).toHaveLength(36);

  const response = await actor.request.get(`/api/notifications/${id}?lang=es`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/notifications$/);
  const nonsense = await actor.request.get("/api/notifications/no-es-un-id", { maxRedirects: 0 });
  expect(nonsense.headers().location).toMatch(/\/notifications$/);
});
