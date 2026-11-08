import { expect, test, type Page } from "@playwright/test";
import { gotoReady } from "./helpers/session";

/**
 * The explore page: text search plus filters (genre, engine, works on mobile) and order, all kept in the address. It runs on the
 * example games of supabase/seeds; games people create in the dev database are ignored when the order matters.
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

test.describe("explorar", () => {
  test("sin filtros muestra los juegos más nuevos y deja elegir género, motor, celular y orden", async ({ page }) => {
    await gotoReady(page, "/explore");
    const filters = page.getByRole("search", { name: "Filtros" });
    await expect(filters.getByLabel("Género")).toHaveValue("");
    await expect(filters.getByLabel("Motor")).toHaveValue("");
    await expect(filters.getByLabel("Ordenar por")).toHaveValue("recent");
    await expect(filters.getByLabel("Ordenar por").locator("option")).toHaveText(["Más nuevos", "En tendencia", "Más jugados"]);
    await expect(filters.getByRole("checkbox", { name: "Solo los que funcionan en celular" })).not.toBeChecked();
    await expect(filters.getByRole("link", { name: "Quitar filtros" })).toHaveCount(0);
    expect((await seedTitles(page)).slice(0, 2)).toEqual(["Órbita", "Granja Cuántica"]);
  });

  test("filtrar por género deja solo ese género, y queda en la dirección", async ({ page }) => {
    await gotoReady(page, "/explore");
    await page.getByRole("search", { name: "Filtros" }).getByLabel("Género").selectOption("arcade");
    await applyFilters(page);
    await expect(page).toHaveURL(/\/explore\?genre=arcade$/);
    expect(await seedTitles(page)).toEqual(expect.arrayContaining(["Neón Express", "Chancleta Run", "Colectivo 152"]));
    expect(await seedTitles(page)).toHaveLength(3);
    await expect(cards(page).filter({ hasNotText: "Arcade" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Quitar filtros" })).toBeVisible();
  });

  test("filtrar por motor y por «funciona en celular» se combinan", async ({ page }) => {
    await gotoReady(page, "/explore?engine=godot");
    expect(await seedTitles(page)).toEqual(expect.arrayContaining(["Luciérnaga Valiente", "Pasillo 9", "Mazmorra 1-Bit", "Granja Cuántica"]));
    await expect(cards(page).filter({ hasNotText: "Godot" })).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Solo los que funcionan en celular" }).check();
    await applyFilters(page);
    await expect(page).toHaveURL(/\/explore\?engine=godot&mobile=1$/);
    const titles = await seedTitles(page);
    expect(titles).toEqual(["Granja Cuántica"]);
  });

  test("ordenar por más jugados y por tendencia", async ({ page }) => {
    await gotoReady(page, "/explore");
    await page.getByLabel("Ordenar por").selectOption("plays");
    await applyFilters(page);
    await expect(page).toHaveURL(/\/explore\?sort=plays$/);
    expect((await seedTitles(page)).slice(0, 3)).toEqual(["Neón Express", "Chancleta Run", "Luciérnaga Valiente"]);

    await page.getByLabel("Ordenar por").selectOption("trending");
    await applyFilters(page);
    await expect(page).toHaveURL(/\/explore\?sort=trending$/);
    await expect(page.getByLabel("Ordenar por")).toHaveValue("trending");
    expect((await seedTitles(page)).length).toBe(16);
  });

  test("el texto, los filtros y el orden trabajan juntos, y quitar los filtros conserva el texto", async ({ page }) => {
    await gotoReady(page, "/explore?q=carton&genre=racing");
    expect(await seedTitles(page)).toEqual(["Kart de Cartón"]);
    await expect(page.getByLabel("Ordenar por").locator("option")).toHaveText(["Más nuevos", "En tendencia", "Más jugados", "Más relevantes"]);
    await expect(page.getByLabel("Ordenar por")).toHaveValue("relevance");

    await page.getByRole("link", { name: "Quitar filtros" }).click();
    await expect(page).toHaveURL(/\/explore\?q=carton$/);
    expect(await seedTitles(page)).toEqual(["Kart de Cartón"]);

    await gotoReady(page, "/explore?q=carton&genre=arcade");
    await expect(page.getByRole("heading", { name: "No encontramos juegos para «carton»" })).toBeVisible();
    await expect(page.getByText("Probá con menos filtros, con otro orden o con otra palabra.")).toBeVisible();
  });

  test("buscar otro texto conserva los filtros y vuelve a la primera página", async ({ page }) => {
    await gotoReady(page, "/explore?genre=arcade&sort=plays");
    const box = page.getByRole("combobox", { name: "Buscar juegos" });
    await box.fill("express");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/explore\?q=express&genre=arcade&sort=plays$/);
    expect(await seedTitles(page)).toEqual(["Neón Express"]);
  });

  test("una dirección con valores raros muestra la vista por defecto, y una página que no existe lo explica", async ({ page }) => {
    await gotoReady(page, "/explore?genre=hack%27%20or%20%271%27%3D%271&engine=flash&sort=zzz&page=-3&mobile=si");
    await expect(page.getByLabel("Género")).toHaveValue("");
    await expect(page.getByLabel("Ordenar por")).toHaveValue("recent");
    expect((await seedTitles(page)).length).toBe(16);

    await gotoReady(page, "/explore?page=99");
    await expect(page.getByRole("heading", { name: "Esa página no existe: volvé a la primera." })).toBeVisible();
    await page.getByRole("link", { name: "Anterior" }).click();
    await expect(page).toHaveURL(/\/explore$/);
  });

  test("en inglés los filtros y los órdenes se traducen", async ({ page }) => {
    await gotoReady(page, "/en/explore?genre=puzzle&sort=plays");
    const filters = page.getByRole("search", { name: "Filters" });
    await expect(filters.getByLabel("Genre")).toHaveValue("puzzle");
    await expect(filters.getByLabel("Sort by").locator("option")).toHaveText(["Newest", "Trending", "Most played"]);
    await expect(page.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/en/explore?sort=plays");
    expect((await seedTitles(page)).slice(0, 2)).toEqual(["Gato Láser", "Torre de Termos"]);
  });
});
