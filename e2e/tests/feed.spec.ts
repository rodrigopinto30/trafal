import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";

/** The community feed (filters by type, older pages, only who you follow) and the share buttons. Runs on the example data of supabase/seeds. */
const PAGE_SIZE = 12;

function cards(page: Page) {
  return page.locator("article").filter({ visible: true });
}

test.describe("feed", () => {
  test("lista las publicaciones más nuevas, sin cuenta, con filtros por tipo y sin las opciones de quien tiene cuenta", async ({ page }) => {
    await gotoReady(page, "/feed");
    await expect(page.getByRole("heading", { level: 1, name: "Comunidad" })).toBeVisible();
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    await expect(page.getByRole("navigation", { name: "Qué ver" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Publicar un avance" })).toHaveCount(0);

    const kinds = page.getByRole("navigation", { name: "Filtrar por tipo" });
    await expect(kinds.getByRole("link")).toHaveText(["Todo", "Avances", "Juegos nuevos", "Piden feedback", "Hitos"]);
    await expect(kinds.getByRole("link", { name: "Todo" })).toHaveAttribute("aria-current", "page");
  });

  test("cada filtro muestra solo publicaciones de ese tipo y queda en la dirección", async ({ page }) => {
    await gotoReady(page, "/feed");
    await page.getByRole("navigation", { name: "Filtrar por tipo" }).getByRole("link", { name: "Hitos" }).click();
    await expect(page).toHaveURL(/\/feed\?kind=hito$/);
    await expect(page.getByRole("navigation", { name: "Filtrar por tipo" }).getByRole("link", { name: "Hitos" })).toHaveAttribute("aria-current", "page");
    const hitos = cards(page);
    await expect(hitos.first()).toBeVisible();
    expect(await hitos.count()).toBeGreaterThan(0);
    await expect(hitos.filter({ hasNotText: "Hito" })).toHaveCount(0);

    await gotoReady(page, "/feed?kind=pide_feedback");
    await expect(cards(page).filter({ hasNotText: "Pide feedback" })).toHaveCount(0);
    expect(await cards(page).count()).toBeGreaterThan(0);
  });

  test("una dirección con valores raros vuelve al feed completo, sin errores", async ({ page }) => {
    await gotoReady(page, "/feed?kind=spam&scope=todos&before=ayer");
    await expect(page.getByRole("navigation", { name: "Filtrar por tipo" }).getByRole("link", { name: "Todo" })).toHaveAttribute("aria-current", "page");
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    await gotoReady(page, "/feed?before=2020-01-01T00:00:00.000Z");
    await expect(page.getByText("Todavía no hay publicaciones.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al principio" }).first()).toHaveAttribute("href", "/feed");
  });

  test("se pasa a las publicaciones más antiguas y se vuelve al principio", async ({ page }) => {
    await gotoReady(page, "/feed");
    const firstTitles = await cards(page).locator("p.whitespace-pre-line").allInnerTexts();
    await page.getByRole("link", { name: "Ver más antiguas" }).click();
    await expect(page).toHaveURL(/\/feed\?before=/);
    const nextTitles = await cards(page).locator("p.whitespace-pre-line").allInnerTexts();
    expect(nextTitles.length).toBeGreaterThan(0);
    for (const text of nextTitles) expect(firstTitles).not.toContain(text);

    await page.getByRole("link", { name: "Volver al principio" }).first().click();
    await expect(page).toHaveURL(/\/feed$/);
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
  });

  test("con cuenta: «A quienes seguís» está vacío al principio y muestra solo lo de la gente que se sigue", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ ...testInfo.project.use });
    const page = await context.newPage();
    const suffix = uniqueSuffix(testInfo.project.name);
    await registerAccount(page, { email: `e2e_feed_${suffix}@trafal.test`, username: `feed_${lettersOnly(suffix)}`, displayName: "Persona Feed" });

    await gotoReady(page, "/feed");
    await expect(page.getByRole("link", { name: "Publicar un avance" })).toBeVisible();
    await page.getByRole("navigation", { name: "Qué ver" }).getByRole("link", { name: "A quienes seguís" }).click();
    await expect(page).toHaveURL(/\/feed\?scope=following$/);
    await expect(page.getByText(/Todavía no hay publicaciones de la gente que seguís/)).toBeVisible();

    await gotoReady(page, "/u/sofi_pixels");
    const followers = page.getByRole("link", { name: /seguidor/ });
    const before = Number((await followers.innerText()).match(/\d+/)?.[0]);
    await page.getByRole("button", { name: "Seguir a @sofi_pixels" }).click();
    await expect(page.getByRole("button", { name: "Dejar de seguir a @sofi_pixels" })).toBeVisible();
    await expect(followers).toContainText(String(before + 1));

    await gotoReady(page, "/feed?scope=following");
    await expect(cards(page).filter({ hasText: "Probando un planeta con anillos" })).toHaveCount(1);
    await expect(cards(page).filter({ hasNotText: "Sofi Pixels" })).toHaveCount(0);

    await gotoReady(page, "/feed?scope=following&kind=hito");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByText(/Todavía no hay publicaciones de la gente que seguís/)).toBeVisible();

    await gotoReady(page, "/u/sofi_pixels");
    await page.getByRole("button", { name: "Dejar de seguir a @sofi_pixels" }).click();
    await expect(page.getByRole("button", { name: "Seguir a @sofi_pixels" })).toBeVisible();
    await expect(page.getByRole("link", { name: /seguidor/ })).toContainText(String(before));
    await context.close();
  });

  test("la portada lleva al feed", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Ver todos los avances" }).click();
    await expect(page).toHaveURL(/\/feed$/);
  });
});

test.describe("compartir", () => {
  test("sin menú de compartir del dispositivo se copia el enlace de la publicación y del juego", async ({ browser }, testInfo) => {
    const context = await browser.newContext({ ...testInfo.project.use, permissions: ["clipboard-read", "clipboard-write"] });
    await context.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
    const page = await context.newPage();

    await gotoReady(page, "/feed");
    const card = cards(page).first();
    await card.getByRole("button", { name: "Compartir" }).click();
    await expect(page.getByText("Enlace copiado").first()).toBeVisible();
    const postHref = (await card.getByRole("link", { name: /comentario/ }).getAttribute("href")) ?? "";
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3000${postHref.replace(/#.*/, "")}`);

    await gotoReady(page, "/games/orbita");
    await page.getByRole("button", { name: "Compartir" }).first().click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("http://localhost:3000/games/orbita");

    await gotoReady(page, "/en/games/orbita");
    await page.getByRole("button", { name: "Share" }).first().click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("http://localhost:3000/en/games/orbita");
    await context.close();
  });

  test("con menú de compartir del dispositivo se usa ese, con el título y la dirección", async ({ browser }, testInfo) => {
    const context = await browser.newContext({ ...testInfo.project.use });
    await context.addInitScript(() => {
      (window as unknown as { shared: unknown[] }).shared = [];
      Object.defineProperty(navigator, "share", { value: async (data: unknown) => (window as unknown as { shared: unknown[] }).shared.push(data), configurable: true });
    });
    const page = await context.newPage();
    await gotoReady(page, "/games/orbita");
    await page.getByRole("button", { name: "Compartir" }).first().click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared)).toEqual([{ title: "Órbita", url: "http://localhost:3000/games/orbita" }]);
    await context.close();
  });
});
