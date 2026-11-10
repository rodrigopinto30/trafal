import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { uploadGameZip } from "./helpers/game";
import { lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { publicGame } from "./helpers/supabase";
import { playableGameZip } from "./helpers/zip";

/**
 * Playing a published game: it runs inside a sandboxed frame served from the games domain (another site from Trafal) by the
 * gateway, which answers with strict security headers. One account publishes one game and the tests below use it; the last
 * one unpublishes it. Needs the gateway running (./start.sh).
 */
test.describe.configure({ mode: "serial" });

const GATEWAY = "http://127.0.0.1:4000";
const SANDBOX = "allow-scripts allow-same-origin allow-pointer-lock allow-modals";

let ownerContext: BrowserContext;
let owner: Page;
let publicId = "";

function frameHeaders(destination: string): Record<string, string> {
  return { host: `${publicId}.games.localhost:4000`, "sec-fetch-dest": destination };
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  ownerContext = await browser.newContext({ ...testInfo.project.use });
  owner = await ownerContext.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(owner, { email: `e2e_player_${suffix}@trafal.test`, username: `player_${lettersOnly(suffix)}`, displayName: "Persona Juegos" });
  await uploadGameZip(owner, "Moon Runner", playableGameZip());
  await expect(owner.getByText("Lista", { exact: true })).toBeVisible({ timeout: 45_000 });
  await owner.getByRole("button", { name: "Publicar juego" }).click();
  await expect(owner.getByText("Tu juego está publicado")).toBeVisible();
  publicId = /\/games\/([a-z0-9]+)\/manage$/.exec(owner.url())?.[1] ?? "";
  expect(publicId).not.toBe("");
});

test.afterAll(async () => {
  await ownerContext?.close();
});

test("una persona sin cuenta juega: el juego corre en un marco aislado del dominio de juegos", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await expect(visitor.getByText("Este juego puede tener sonido.")).toBeVisible();
  await expect(visitor.locator("iframe")).toHaveCount(0);

  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  const frame = visitor.locator('iframe[title="Juego: Moon Runner"]');
  await expect(frame).toHaveAttribute("src", `http://${publicId}.games.localhost:4000/`);
  await expect(frame).toHaveAttribute("sandbox", SANDBOX);
  await expect(frame).toHaveAttribute("allow", /fullscreen/);
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  for (const forbidden of ["allow-top-navigation", "allow-popups", "allow-forms", "allow-downloads"]) {
    expect(await frame.getAttribute("sandbox")).not.toContain(forbidden);
  }
  await expect(visitor.frameLocator('iframe[title="Juego: Moon Runner"]').locator("#status")).toHaveText("corriendo");

  await expect.poll(async () => (await publicGame(publicId))?.play_count, { timeout: 15_000 }).toBe(1);
  await visitor.reload();
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  await expect(visitor.frameLocator('iframe[title="Juego: Moon Runner"]').locator("#status")).toHaveText("corriendo");
  await expect.poll(async () => (await publicGame(publicId))?.play_count, { timeout: 15_000 }).toBe(2);
  await context.close();
});

test("pantalla completa y reiniciar", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  const inner = visitor.frameLocator('iframe[title="Juego: Moon Runner"]');
  await expect(inner.locator("#status")).toHaveText("corriendo");

  await visitor.getByRole("button", { name: "Pantalla completa", exact: true }).click();
  await expect(visitor.getByRole("button", { name: "Salir de pantalla completa", exact: true }).first()).toBeVisible();
  await visitor.getByRole("button", { name: "Salir de pantalla completa", exact: true }).first().click();
  await expect(visitor.getByRole("button", { name: "Pantalla completa", exact: true })).toBeVisible();

  await inner.locator("#status").evaluate((element) => {
    element.textContent = "tocado por la prueba";
  });
  await visitor.getByRole("button", { name: "Reiniciar" }).click();
  await expect(inner.locator("#status")).toHaveText("corriendo");
  await context.close();
});

test("reportar: quien no tiene cuenta debe iniciar sesión; quien la tiene reporta una sola vez", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await visitor.getByRole("button", { name: "Reportar" }).click();
  await expect(visitor.getByText("Para reportar tenés que iniciar sesión")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", new RegExp(`/login\\?next=%2Fgames%2F${publicId}`));
  await context.close();

  await owner.goto(`/games/${publicId}`);
  await owner.getByRole("button", { name: "Reportar" }).click();
  const dialog = owner.getByRole("dialog", { name: "Reportar este juego" });
  await expect(dialog.getByRole("button", { name: "Enviar reporte" })).toBeDisabled();
  await dialog.getByLabel("Motivo").selectOption("broken");
  await dialog.getByLabel("Detalles (opcional)").fill("No carga el nivel 2.");
  await dialog.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(dialog.getByText("Recibimos tu reporte")).toBeVisible();
  await owner.keyboard.press("Escape");

  await owner.getByRole("button", { name: "Reportar" }).click();
  await owner.getByRole("dialog").getByLabel("Motivo").selectOption("spam");
  await owner.getByRole("dialog").getByRole("button", { name: "Enviar reporte" }).click();
  await expect(owner.getByText("Ya reportaste esto")).toBeVisible();
});

test("el gateway responde con cabeceras estrictas y solo sirve HTML dentro de un marco", async ({ page, request }) => {
  const framed = await request.get(`${GATEWAY}/`, { headers: frameHeaders("iframe"), maxRedirects: 0 });
  expect(framed.status()).toBe(200);
  expect(framed.headers()["content-type"]).toContain("text/html");
  const csp = framed.headers()["content-security-policy"] ?? "";
  for (const directive of ["connect-src 'self'", "form-action 'none'", "object-src 'none'", "frame-src 'none'", "frame-ancestors http://localhost:3000"]) {
    expect(csp).toContain(directive);
  }
  expect(framed.headers()["x-content-type-options"]).toBe("nosniff");
  expect(framed.headers()["referrer-policy"]).toBe("no-referrer");
  expect(framed.headers()["access-control-allow-origin"]).toBeUndefined();
  expect(framed.headers()["set-cookie"]).toBeUndefined();

  const direct = await request.get(`${GATEWAY}/`, { headers: frameHeaders("document"), maxRedirects: 0 });
  expect(direct.status()).toBe(302);
  expect(direct.headers().location).toBe(`http://localhost:3000/games/${publicId}`);

  const script = await request.get(`${GATEWAY}/game.js`, { headers: frameHeaders("script"), maxRedirects: 0 });
  expect(script.status()).toBe(200);
  expect(script.headers()["content-type"]).toContain("text/javascript");

  const unknown = await request.get(`${GATEWAY}/`, { headers: { host: "nobody.games.localhost:4000", "sec-fetch-dest": "iframe" } });
  expect(unknown.status()).toBe(404);
  const bareDomain = await request.get(`${GATEWAY}/`, { headers: { host: "games.localhost:4000", "sec-fetch-dest": "iframe" } });
  expect(bareDomain.status()).toBe(404);
  const traversal = await request.get(`${GATEWAY}/%2e%2e/%2e%2e/etc/passwd`, { headers: frameHeaders("iframe") });
  expect(traversal.status()).toBe(404);
  const post = await request.post(`${GATEWAY}/`, { headers: frameHeaders("iframe"), data: "x" });
  expect(post.status()).toBe(405);

  await page.goto(`http://${publicId}.games.localhost:4000/`);
  await expect(page).toHaveURL(`/games/${publicId}`);
});

test("un juego que se vuelve borrador deja de servirse en pocos segundos", async ({ request }) => {
  await owner.goto(`/games/${publicId}/manage`);
  await owner.getByRole("button", { name: "Volver a borrador" }).click();
  await expect(owner.getByText("Tu juego pasó la revisión y sigue siendo un borrador")).toBeVisible();
  await expect.poll(async () => (await request.get(`${GATEWAY}/`, { headers: frameHeaders("iframe") })).status(), { timeout: 20_000, intervals: [1000] }).toBe(404);
});
