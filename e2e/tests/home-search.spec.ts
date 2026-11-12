import { expect, test, type Page } from "@playwright/test";
import { gotoReady } from "./helpers/session";

/**
 * The search view of the home (`/?q=…&genre=…`): text search plus filters (genre) and order, all kept in the
 * address, for visitors and for people signed in. It runs on the example games of supabase/seeds; games people create in the dev
 * database are ignored when the order matters.
 */
const SEEDS = new Set([
  "Órbita", "Granja Cuántica", "El Faro", "Luciérnaga Valiente", "Colectivo 152", "Isla Eco", "Gato Láser", "Pulpo DJ",
  "Pasillo 9", "Mazmorra 1-Bit", "Torre de Termos", "Hechizo 404", "Neón Express", "Kart de Cartón", "Chancleta Run", "Bit Bakery",
]);

function cards(page: Page) {
  return page.getByRole("article").filter({ visible: true });
}

async function seedTitles(page: Page): Promise<string[]> {
  const titles = await cards(page).getByRole("heading").allInnerTexts();
  return titles.filter((title) => SEEDS.has(title));
}

async function applyFilters(page: Page) {
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.waitForLoadState("networkidle");
}

test.describe("buscar en la portada", () => {
  test("una búsqueda sin filtros deja elegir género y orden, y quitar filtros no aparece", async ({ page }) => {
    await gotoReady(page, "/?sort=plays");
    const filters = page.getByRole("search", { name: "Filtros" });
    await expect(filters.getByLabel("Género")).toHaveValue("");
    await expect(filters.getByLabel("Ordenar por")).toHaveValue("plays");
    await expect(filters.getByLabel("Ordenar por").locator("option")).toHaveText(["Más nuevos", "En tendencia", "Más jugados"]);
    await expect(filters.getByRole("link", { name: "Quitar filtros" })).toHaveCount(0);
    expect((await seedTitles(page)).slice(0, 2)).toEqual(["Neón Express", "Chancleta Run"]);
  });

  test("filtrar por género deja solo ese género, y queda en la dirección", async ({ page }) => {
    await gotoReady(page, "/?genre=puzzle");
    await page.getByRole("search", { name: "Filtros" }).getByLabel("Género").selectOption("arcade");
    await applyFilters(page);
    await expect(page).toHaveURL(/\/\?genre=arcade$/);
    expect(await seedTitles(page)).toEqual(expect.arrayContaining(["Neón Express", "Chancleta Run", "Colectivo 152"]));
    expect(await seedTitles(page)).toHaveLength(3);
    await expect(cards(page).filter({ hasNotText: "Arcade" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Quitar filtros" })).toBeVisible();
  });

  test("ordenar por más jugados y por tendencia", async ({ page }) => {
    await gotoReady(page, "/?genre=puzzle");
    await page.getByLabel("Género").selectOption("");
    await page.getByLabel("Ordenar por").selectOption("plays");
    await applyFilters(page);
    await expect(page).toHaveURL(/\/\?sort=plays$/);
    expect((await seedTitles(page)).slice(0, 3)).toEqual(["Neón Express", "Chancleta Run", "Luciérnaga Valiente"]);

    await page.getByLabel("Ordenar por").selectOption("trending");
    await applyFilters(page);
    await expect(page).toHaveURL(/\/\?sort=trending$/);
    await expect(page.getByLabel("Ordenar por")).toHaveValue("trending");
    expect((await seedTitles(page)).length).toBe(16);
  });

  test("el texto, los filtros y el orden trabajan juntos, y quitar los filtros conserva el texto", async ({ page }) => {
    await gotoReady(page, "/?q=carton&genre=racing");
    expect(await seedTitles(page)).toEqual(["Kart de Cartón"]);
    await expect(page.getByLabel("Ordenar por").locator("option")).toHaveText(["Más nuevos", "En tendencia", "Más jugados", "Más relevantes"]);
    await expect(page.getByLabel("Ordenar por")).toHaveValue("relevance");

    await page.getByRole("link", { name: "Quitar filtros" }).click();
    await expect(page).toHaveURL(/\/\?q=carton$/);
    expect(await seedTitles(page)).toEqual(["Kart de Cartón"]);

    await gotoReady(page, "/?q=carton&genre=arcade");
    await expect(page.getByRole("heading", { name: "No encontramos juegos para «carton»" })).toBeVisible();
    await expect(page.getByText("Probá con menos filtros, con otro orden o con otra palabra.")).toBeVisible();
  });

  test("buscar otro texto conserva los filtros y vuelve a la primera página", async ({ page }) => {
    await gotoReady(page, "/?genre=arcade&sort=plays");
    const box = page.getByRole("combobox", { name: "Buscar juegos" });
    await box.fill("express");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/\?q=express&genre=arcade&sort=plays$/);
    expect(await seedTitles(page)).toEqual(["Neón Express"]);
  });

  test("una dirección con valores raros no rompe nada: es la portada de siempre, y una página que no existe lo explica", async ({ page }) => {
    await gotoReady(page, "/?genre=hack%27%20or%20%271%27%3D%271&sort=zzz&page=-3");
    await expect(page.getByRole("search", { name: "Filtros" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();

    await gotoReady(page, "/?page=99");
    await expect(page.getByRole("heading", { name: "Esa página no existe: volvé a la primera." })).toBeVisible();
    await page.getByRole("link", { name: "Anterior" }).click();
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });

  test("en inglés los filtros y los órdenes se traducen", async ({ page }) => {
    await gotoReady(page, "/en/?genre=puzzle&sort=plays");
    const filters = page.getByRole("search", { name: "Filters" });
    await expect(filters.getByLabel("Genre")).toHaveValue("puzzle");
    await expect(filters.getByLabel("Sort by").locator("option")).toHaveText(["Newest", "Trending", "Most played"]);
    await expect(page.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/en?sort=plays");
    expect((await seedTitles(page)).slice(0, 2)).toEqual(["Gato Láser", "Torre de Termos"]);
  });
});
