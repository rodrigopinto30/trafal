import { expect, test, type Page } from "@playwright/test";
import { gotoReady } from "./helpers/session";

const SECTION_TITLES = [
  "Recién publicados",
  "Los más jugados",
  "Lo que dice la comunidad",
  "Primeros juegos",
  "Por género",
  "Novedades de los creadores",
];

/** The 16 example games of supabase/seeds. Games people create in the dev database are not in this list and must not break the tests. */
const SEED_TITLES = new Set([
  "Órbita",
  "Granja Cuántica",
  "El Faro",
  "Luciérnaga Valiente",
  "Colectivo 152",
  "Isla Eco",
  "Gato Láser",
  "Pulpo DJ",
  "Pasillo 9",
  "Mazmorra 1-Bit",
  "Torre de Termos",
  "Hechizo 404",
  "Neón Express",
  "Kart de Cartón",
  "Chancleta Run",
  "Bit Bakery",
]);

/** Titles of the example games shown in a section, in the order shown, ignoring any other game that may be published. */
async function seedTitlesIn(page: Page, region: string): Promise<string[]> {
  const titles = await page.getByRole("region", { name: region }).getByRole("article").getByRole("heading").allInnerTexts();
  return titles.filter((title) => SEED_TITLES.has(title));
}

test.describe("portada", () => {
  test("muestra las secciones de juegos y comunidad en orden, intercaladas con banners", async ({ page }) => {
    await gotoReady(page, "/");
    const headings = await page.locator("#contenido h2").allInnerTexts();
    const positions = SECTION_TITLES.map((title) => headings.indexOf(title));
    expect(positions.every((position) => position >= 0), `faltan secciones: ${headings.join(" | ")}`).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    expect(headings[0]).toBe("Neón Express");
    expect(headings.indexOf("Órbita")).toBeGreaterThan(positions[1] as number);
    expect(headings.indexOf("Órbita")).toBeLessThan(positions[2] as number);
  });

  test("«Recién publicados» y «Los más jugados» listan 8 juegos cada uno, bien ordenados", async ({ page }) => {
    await gotoReady(page, "/");
    const recent = page.getByRole("region", { name: "Recién publicados" }).getByRole("article");
    await expect(recent).toHaveCount(8);
    expect((await seedTitlesIn(page, "Recién publicados")).slice(0, 2)).toEqual(["Órbita", "Granja Cuántica"]);

    const mostPlayed = page.getByRole("region", { name: "Los más jugados" }).getByRole("article");
    await expect(mostPlayed).toHaveCount(8);
    expect((await seedTitlesIn(page, "Los más jugados")).slice(0, 2)).toEqual(["Neón Express", "Chancleta Run"]);
    await expect(mostPlayed.first()).toContainText("Puesto 1");
  });

  test("un banner lleva a la página del juego, donde se puede entrar sin cuenta", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Jugar gratis: Neón Express" }).click();
    await expect(page).toHaveURL(/\/games\/neon-express$/);
    await expect(page.getByRole("heading", { level: 1, name: "Neón Express" })).toBeVisible();
  });

  test("el primer juego de la semana lleva la frase del equipo", async ({ page }) => {
    await gotoReady(page, "/");
    const banner = page.getByRole("region", { name: "Órbita" }).first();
    await expect(banner).toContainText("Primer juego de la semana");
    await expect(banner).toContainText("Un puzzle de gravedad con una idea clarísima");
  });

  test("tocar una tarjeta abre la página de ese juego", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("region", { name: "Recién publicados" }).getByRole("link", { name: "Granja Cuántica" }).click();
    await expect(page).toHaveURL(/\/games\/granja-cuantica$/);
    await expect(page.getByRole("heading", { level: 1, name: "Granja Cuántica" })).toBeVisible();
  });

  test("la comunidad muestra mensajes reales e invita a registrarse", async ({ page }) => {
    await gotoReady(page, "/");
    const community = page.getByRole("region", { name: "Lo que dice la comunidad" });
    await expect(community.getByRole("figure")).toHaveCount(5);
    await expect(community.getByText("Tu opinión también cuenta")).toBeVisible();
    await community.getByRole("link", { name: "Crear mi cuenta" }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("los estantes por género y las novedades de los creadores están completos", async ({ page }) => {
    await gotoReady(page, "/");
    const genres = page.getByRole("region", { name: "Por género" });
    await expect(genres.getByRole("heading", { level: 3 })).toHaveText([/Arcade/, /Puzzle/, /Cozy/]);
    await expect(page.getByRole("region", { name: "Novedades de los creadores" }).getByRole("article")).toHaveCount(6);
    await expect(page.getByRole("region", { name: "Primeros juegos" }).getByRole("article")).toHaveCount(4);
  });

  test("en inglés las secciones se traducen y el contenido de los creadores queda como lo escribieron", async ({ page }) => {
    await gotoReady(page, "/en");
    await expect(page.getByRole("region", { name: "Just published" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Most played" })).toBeVisible();
    await expect(page.getByRole("region", { name: "What the community says" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Just published" })).toContainText("Órbita");
  });
});
