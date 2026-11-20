import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { uniqueTitle, unpublishGame, uploadAndPublishGame } from "./helpers/game";
import { lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { publicGame } from "./helpers/supabase";
import { playableGameZip } from "./helpers/zip";

/**
 * Playing a published game: it runs inside a sandboxed frame served from the games domain (another site from Tradfal) by the
 * gateway, which answers with strict security headers. One account publishes one game and the tests below use it; the last
 * one unpublishes it. Needs the gateway running (./start.sh).
 */
test.describe.configure({ mode: "serial" });

const GATEWAY = "http://127.0.0.1:4000";
const SANDBOX = "allow-scripts allow-same-origin allow-pointer-lock allow-modals";

let ownerContext: BrowserContext;
let owner: Page;
let publicId = "";
let gameTitle = "";

function frameHeaders(destination: string): Record<string, string> {
  return { host: `${publicId}.games.localhost:4000`, "sec-fetch-dest": destination };
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  ownerContext = await browser.newContext({ ...testInfo.project.use });
  owner = await ownerContext.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(owner, { email: `e2e_player_${suffix}@tradfal.test`, username: `player_${lettersOnly(suffix)}`, displayName: "Persona Juegos" });
  gameTitle = uniqueTitle("Moon Runner");
  publicId = await uploadAndPublishGame(owner, gameTitle, playableGameZip());
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
  const frame = visitor.locator(`iframe[title="Juego: ${gameTitle}"]`);
  await expect(frame).toHaveAttribute("src", `http://${publicId}.games.localhost:4000/`);
  await expect(frame).toHaveAttribute("sandbox", SANDBOX);
  await expect(frame).toHaveAttribute("allow", /fullscreen/);
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  for (const forbidden of ["allow-top-navigation", "allow-popups", "allow-forms", "allow-downloads"]) {
    expect(await frame.getAttribute("sandbox")).not.toContain(forbidden);
  }
  await expect(visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`).locator("#status")).toHaveText("corriendo");

  await expect.poll(async () => (await publicGame(publicId))?.play_count, { timeout: 15_000 }).toBe(1);
  await visitor.reload();
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  await expect(visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`).locator("#status")).toHaveText("corriendo");
  await expect.poll(async () => (await publicGame(publicId))?.play_count, { timeout: 15_000 }).toBe(2);
  await context.close();
});

test("pantalla completa y reiniciar", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  const inner = visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`);
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

test("el reproductor se ajusta a la pantalla y trae sus propios controles abajo a la derecha", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use, viewport: { width: 1366, height: 650 } });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  const inner = visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`);
  await expect(inner.locator("#status")).toHaveText("corriendo");

  const frame = visitor.locator(`iframe[title="Juego: ${gameTitle}"]`);
  const bar = visitor.getByRole("toolbar", { name: "Controles del reproductor" });
  await expect(bar).toBeVisible();
  const [frameBox, barBox, viewport] = await Promise.all([frame.boundingBox(), bar.boundingBox(), visitor.evaluate(() => ({ height: window.innerHeight, scrollY: window.scrollY }))]);
  if (!frameBox || !barBox) throw new Error("the player is not on screen");
  expect(barBox.y + barBox.height, "the whole player, bar included, fits in the window without scrolling").toBeLessThanOrEqual(viewport.height + 1);
  expect(frameBox.width / frameBox.height).toBeCloseTo(16 / 9, 1);
  expect(frameBox.width).toBeLessThanOrEqual(1280);

  const fullscreen = visitor.getByRole("button", { name: "Pantalla completa", exact: true });
  const fullscreenBox = await fullscreen.boundingBox();
  if (!fullscreenBox) throw new Error("no fullscreen button");
  expect(fullscreenBox.x + fullscreenBox.width, "the fullscreen button is the last control, at the bottom right").toBeGreaterThan(barBox.x + barBox.width - 16);
  expect(fullscreenBox.y).toBeGreaterThan(frameBox.y + frameBox.height - 2);
  expect(fullscreenBox.width).toBeGreaterThanOrEqual(44);
  expect(fullscreenBox.height).toBeGreaterThanOrEqual(44);
  await context.close();
});

test("el sonido se silencia desde la plataforma, para cualquier juego, y se recuerda", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  const inner = visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`);
  await expect(inner.locator("#status")).toHaveText("corriendo");
  await expect(inner.locator("#bridge")).toHaveText("si");
  await expect(inner.locator("#patched")).toHaveText("si");

  const mute = visitor.getByRole("button", { name: "Silenciar", exact: true });
  await expect(mute).toBeVisible();
  await expect.poll(async () => inner.locator("#last").textContent()).toBe('{"tradfal":1,"type":"mute","muted":false}');
  await mute.click();
  await expect(visitor.getByRole("button", { name: "Activar sonido", exact: true })).toBeVisible();
  await expect.poll(async () => inner.locator("#last").textContent()).toBe('{"tradfal":1,"type":"mute","muted":true}');
  await expect(visitor.locator(`iframe[title="Juego: ${gameTitle}"]`), "the keyboard goes back to the game after pressing a player button").toBeFocused();

  await visitor.reload();
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  await expect(visitor.getByRole("button", { name: "Activar sonido", exact: true })).toBeVisible();
  await expect.poll(async () => visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`).locator("#last").textContent()).toBe('{"tradfal":1,"type":"mute","muted":true}');
  await visitor.getByRole("button", { name: "Activar sonido", exact: true }).click();
  await expect.poll(async () => visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`).locator("#last").textContent()).toBe('{"tradfal":1,"type":"mute","muted":false}');
  await context.close();
});

test("la vista maximizada (sin pantalla completa del navegador) no se cierra con Esc: se sale con el mismo botón", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  await context.addInitScript(() => {
    Object.defineProperty(Document.prototype, "fullscreenEnabled", { configurable: true, get: () => false });
  });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  await expect(visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`).locator("#status")).toHaveText("corriendo");

  await visitor.getByRole("button", { name: "Pantalla completa", exact: true }).click();
  const exit = visitor.getByRole("button", { name: "Salir de pantalla completa", exact: true });
  await expect(exit).toBeVisible();
  await visitor.keyboard.press("Escape");
  await visitor.locator("body").press("Escape");
  await expect(exit, "Escape does not leave the maximized view").toBeVisible();
  await exit.click();
  await expect(visitor.getByRole("button", { name: "Pantalla completa", exact: true })).toBeVisible();
  await context.close();
});

test("mantener Esc apretado dentro del juego devuelve el teclado a los controles, aunque el juego se quede con Tab", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  await expect(visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`).locator("#status")).toHaveText("corriendo");

  const frame = visitor.locator(`iframe[title="Juego: ${gameTitle}"]`);
  const hint = visitor.locator(`[id="${await frame.getAttribute("aria-describedby")}"]`);
  await expect(hint, "the frame tells screen readers how to get out").toHaveText("Mantené Esc apretado para volver a estos controles");
  if (testInfo.project.name === "desktop") await expect(hint).toBeVisible();

  const game = await (await frame.elementHandle())?.contentFrame();
  if (!game) throw new Error("no game frame");
  await game.evaluate(() => {
    window.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Tab" && event.key !== "Escape") return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
  });
  await visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`).locator("body").click();
  await visitor.keyboard.press("Tab");
  await visitor.keyboard.press("Shift+Tab");
  await expect(frame, "this game keeps the Tab key: the focus cannot leave by tabbing").toBeFocused();

  await visitor.keyboard.press("Escape");
  await visitor.waitForTimeout(1500);
  await expect(frame, "a short Escape still belongs to the game").toBeFocused();

  await visitor.keyboard.down("Escape");
  await expect(visitor.getByRole("button", { name: "Reiniciar", exact: true }), "held Escape brings the keyboard back to the controls").toBeFocused({ timeout: 4000 });
  await visitor.keyboard.up("Escape");
  await visitor.keyboard.press("Tab");
  await expect(frame).not.toBeFocused();
  await context.close();
});

test("en pantalla completa el juego recibe las teclas que el navegador se guardaría", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  await context.addInitScript(() => {
    const calls: Array<string[] | undefined> = [];
    let unlocked = 0;
    Object.defineProperty(window, "__keyboardLock", { value: { calls, get unlocked() { return unlocked; } } });
    Object.defineProperty(navigator, "keyboard", { configurable: true, value: { lock: async (keys?: string[]) => void calls.push(keys), unlock: () => void (unlocked += 1) } });
  });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  await visitor.getByRole("button", { name: "Jugar gratis" }).click();
  await expect(visitor.frameLocator(`iframe[title="Juego: ${gameTitle}"]`).locator("#status")).toHaveText("corriendo");
  await visitor.getByRole("button", { name: "Pantalla completa", exact: true }).click();
  const fullscreenWorked = await visitor.evaluate(() => Boolean(document.fullscreenElement));
  if (fullscreenWorked) {
    const calls = await visitor.evaluate(() => (window as unknown as { __keyboardLock: { calls: string[][] } }).__keyboardLock.calls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.arrayContaining(["KeyW", "KeyR", "Digit1", "Space"]));
    expect(calls[0], "a press of Escape goes to the game instead of leaving fullscreen").toContain("Escape");
    await visitor.getByRole("button", { name: "Salir de pantalla completa", exact: true }).click();
    await expect.poll(() => visitor.evaluate(() => (window as unknown as { __keyboardLock: { unlocked: number } }).__keyboardLock.unlocked)).toBeGreaterThan(0);
  }
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
  await unpublishGame(owner, publicId);
  await expect.poll(async () => (await request.get(`${GATEWAY}/`, { headers: frameHeaders("iframe") })).status(), { timeout: 20_000, intervals: [1000] }).toBe(404);
});
