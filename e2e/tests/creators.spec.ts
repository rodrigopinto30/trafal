import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";

/** The creators directory: people with a published game, searched by name, engine or favorite genre, and followed from their card. Runs on the example accounts of supabase/seeds. */
function cards(page: Page) {
  return page.getByRole("article").filter({ visible: true });
}

function usernames(page: Page): Promise<string[]> {
  return cards(page).getByText(/^@/).allInnerTexts();
}

async function numbersOf(page: Page, word: RegExp): Promise<number[]> {
  const texts = await cards(page).getByText(word).allInnerTexts();
  return texts.map((text) => Number(word.exec(text)?.[1]));
}

async function applyFilters(page: Page) {
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.waitForLoadState("networkidle");
}

test.describe("creadores", () => {
  test("lista a quienes tienen un juego publicado, con su perfil, y deja buscar, filtrar y ordenar", async ({ page }) => {
    await gotoReady(page, "/creators");
    await expect(page.getByRole("heading", { level: 1, name: "Creadores" })).toBeVisible();
    const filters = page.getByRole("search", { name: "Buscar y filtrar creadores" });
    await expect(filters.getByLabel("Buscar creadores")).toHaveValue("");
    await expect(filters.getByLabel("Ordenar por")).toHaveValue("newest");
    await expect(filters.getByLabel("Ordenar por").locator("option")).toHaveText(["Más nuevos", "Más seguidos", "Con más juegos"]);

    const names = await usernames(page);
    expect(names).toEqual(expect.arrayContaining(["@valen_makes", "@sofi_pixels", "@mateo_g", "@julistudio"]));
    expect(names).not.toContain("@equipo_trafal");
    await expect(page.getByRole("status").filter({ hasText: /creadores/ })).toBeVisible();

    const card = cards(page).filter({ hasText: "@mateo_g" });
    await expect(card.getByRole("link", { name: /Ver el perfil de/ })).toHaveAttribute("href", "/u/mateo_g");
    await expect(card).toContainText("Phaser");
    await expect(card).toContainText("3 juegos");
  });

  test("filtrar por motor y por género", async ({ page }) => {
    await gotoReady(page, "/creators");
    await page.getByRole("search", { name: "Buscar y filtrar creadores" }).getByLabel("Motor que usan").selectOption("godot");
    await applyFilters(page);
    await expect(page).toHaveURL(/\/creators\?engine=godot$/);
    const godot = await usernames(page);
    expect(godot).toEqual(expect.arrayContaining(["@valen_makes", "@tomi_dev"]));
    expect(godot).not.toContain("@sofi_pixels");
    await expect(cards(page).filter({ hasNotText: "Godot" })).toHaveCount(0);

    await gotoReady(page, "/creators?genre=puzzle");
    expect(await usernames(page)).toEqual(expect.arrayContaining(["@valen_makes", "@sofi_pixels", "@julistudio"]));
    expect(await usernames(page)).not.toContain("@mateo_g");

    await gotoReady(page, "/creators?engine=godot&genre=puzzle");
    const both = await usernames(page);
    expect(both).toContain("@valen_makes");
    expect(both).not.toContain("@tomi_dev");
    await page.getByRole("link", { name: "Quitar filtros" }).click();
    await expect(page).toHaveURL(/\/creators$/);
  });

  test("ordenar por más seguidos y por más juegos deja la lista de mayor a menor", async ({ page }) => {
    await gotoReady(page, "/creators?sort=followers");
    const followers = await numbersOf(page, /(\d+) seguidor/);
    expect(followers.length).toBeGreaterThan(3);
    expect(followers).toEqual([...followers].sort((a, b) => b - a));

    await gotoReady(page, "/creators?sort=games");
    const games = await numbersOf(page, /(\d+) juego/);
    expect(games).toEqual([...games].sort((a, b) => b - a));
    await expect(page.getByLabel("Ordenar por")).toHaveValue("games");
  });

  test("buscar por nombre o @usuario, sin importar tildes ni mayúsculas, y combinar con filtros", async ({ page }) => {
    await gotoReady(page, "/creators");
    await page.getByLabel("Buscar creadores").fill("JULI");
    await applyFilters(page);
    await expect(page).toHaveURL(/\/creators\?q=JULI$/);
    expect(await usernames(page)).toEqual(["@julistudio"]);

    await gotoReady(page, "/creators?q=pixels");
    expect(await usernames(page)).toEqual(expect.arrayContaining(["@sofi_pixels", "@caro_pixels"]));

    await gotoReady(page, "/creators?q=pixels&engine=pico8");
    expect(await usernames(page)).toEqual(["@caro_pixels"]);

    await gotoReady(page, "/creators?q=zzzz");
    await expect(page.getByRole("heading", { name: "No encontramos creadores con esa búsqueda" })).toBeVisible();
    await page.getByRole("link", { name: "Ver todos los creadores" }).click();
    await expect(page).toHaveURL(/\/creators$/);
  });

  test("una dirección con valores raros muestra la vista por defecto, y una página que no existe lo explica", async ({ page }) => {
    await gotoReady(page, "/creators?engine=flash&genre=%27%20or%201%3D1&sort=zzz&page=-3");
    await expect(page.getByLabel("Ordenar por")).toHaveValue("newest");
    expect((await usernames(page)).length).toBeGreaterThan(3);

    await gotoReady(page, "/creators?page=99");
    await expect(page.getByRole("heading", { name: "Esa página no existe: volvé a la primera." })).toBeVisible();
    await page.getByRole("link", { name: "Anterior" }).click();
    await expect(page).toHaveURL(/\/creators$/);
  });

  test("quien no tiene cuenta pasa por el inicio de sesión para seguir", async ({ page }) => {
    await gotoReady(page, "/creators?q=julistudio");
    await expect(cards(page).getByRole("link", { name: "Seguir" })).toHaveAttribute("href", `/login?next=${encodeURIComponent("/u/julistudio")}`);
  });

  test("con cuenta se sigue y se deja de seguir desde la tarjeta, y el estado persiste", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ ...testInfo.project.use });
    const page = await context.newPage();
    const suffix = uniqueSuffix(testInfo.project.name);
    await registerAccount(page, { email: `e2e_creators_${suffix}@trafal.test`, username: `creators_${lettersOnly(suffix)}`, displayName: "Persona Creadores" });

    await gotoReady(page, "/creators?q=julistudio");
    const card = cards(page).filter({ hasText: "@julistudio" });
    const before = Number(/(\d+) seguidor/.exec(await card.innerText())?.[1]);
    await card.getByRole("button", { name: "Seguir a @julistudio" }).click();
    await expect(card.getByRole("button", { name: "Dejar de seguir a @julistudio" })).toBeVisible();
    await expect(card).toContainText(`${before + 1} seguidor`);

    await gotoReady(page, "/creators?q=julistudio");
    await expect(cards(page).filter({ hasText: "@julistudio" }).getByRole("button", { name: "Dejar de seguir a @julistudio" })).toBeVisible();

    const again = cards(page).filter({ hasText: "@julistudio" });
    await again.getByRole("button", { name: "Dejar de seguir a @julistudio" }).click();
    await expect(again.getByRole("button", { name: "Seguir a @julistudio" })).toBeVisible();
    await expect(again).toContainText(`${before} seguidor`);
    await context.close();
  });

  test("en inglés todo se traduce", async ({ page }) => {
    await gotoReady(page, "/en/creators?genre=cozy&sort=followers");
    await expect(page.getByRole("heading", { level: 1, name: "Creators" })).toBeVisible();
    const filters = page.getByRole("search", { name: "Search and filter creators" });
    await expect(filters.getByLabel("Sort by").locator("option")).toHaveText(["Newest", "Most followed", "Most games"]);
    await expect(page.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/en/creators?sort=followers");
    await expect(page.getByRole("status")).toContainText(/creator/);
    expect(await usernames(page)).toContain("@caro_pixels");
  });
});
