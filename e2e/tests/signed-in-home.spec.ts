import { expect, test } from "@playwright/test";
import { gotoReady, loginAndWait, logout, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";

/**
 * The home of someone who is signed in. The address is the same («/»), but the page is another one, built like the search view: a
 * slogan, the search box and the filters, then games, the news from the people they follow and more shelves of games (no banners, no
 * invitation to create an account). Searching from it shows the results in place. Visitors keep the public home.
 */
const VALEN = { email: "valen@trafal.test", password: "trafal123" };

test("quien inició sesión ve su portada en la misma dirección: lema, buscador, filtros, juegos, novedades de a quienes sigue y más estantes", async ({ page }) => {
  await loginAndWait(page, VALEN.email, VALEN.password);
  await gotoReady(page, "/");
  await expect(page).toHaveURL(/localhost:3000\/$/);

  await expect(page.getByRole("heading", { level: 1, name: "Juegos del navegador, hechos por la comunidad" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByRole("search", { name: "Buscar juegos" })).toBeVisible();
  await expect(main.getByRole("search", { name: "Filtros" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Sorprendeme" })).toBeVisible();

  await expect(main.getByRole("heading", { level: 2, name: "Novedades de quienes seguís" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Ver todo lo que publican" })).toHaveAttribute("href", "/feed?scope=following");
  await expect(main.getByRole("heading", { level: 2, name: "Recién agregados" })).toBeVisible();
  expect(await main.getByRole("article").filter({ has: page.getByRole("heading", { level: 3 }) }).count(), "varios juegos").toBeGreaterThanOrEqual(8);

  const top = async (name: string) => (await main.getByRole("heading", { level: 2, name }).boundingBox())?.y ?? Number.NaN;
  const [box, recent, news, played] = await Promise.all([main.getByRole("search", { name: "Buscar juegos" }).boundingBox(), top("Recién agregados"), top("Novedades de quienes seguís"), top("Los más jugados")]);
  expect(box && box.y < recent, "los juegos van debajo del buscador").toBe(true);
  expect(recent < news, "las novedades van después de los primeros juegos").toBe(true);
  expect(news < played).toBe(true);
  await expect(main.getByRole("heading", { level: 2, name: "Los más jugados" })).toBeVisible();
  await expect(main.getByRole("heading", { level: 2, name: "Primeros juegos" })).toBeVisible();

  await expect(main.getByRole("link", { name: "Jugar gratis" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Crear cuenta" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: /Cómo funciona|Lo que dice la comunidad|Por género/ })).toHaveCount(0);
});

test("buscar desde la portada con sesión muestra los resultados ahí mismo, con el lema, y sin las novedades", async ({ page }) => {
  await loginAndWait(page, VALEN.email, VALEN.password);
  await gotoReady(page, "/");
  const box = page.getByRole("combobox", { name: "Buscar juegos" });
  await box.fill("láser");
  await box.press("Enter");
  await expect(page).toHaveURL(/localhost:3000\/\?q=l%C3%A1ser$/);
  await expect(page.getByRole("heading", { level: 1, name: "Juegos del navegador, hechos por la comunidad" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Resultados para «láser»" })).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Gato Láser");
  await expect(page.getByRole("heading", { level: 2, name: "Novedades de quienes seguís" })).toHaveCount(0);
});

test("la portada pública no cambia para los visitantes, y al cerrar sesión se vuelve a ver", async ({ page }) => {
  await gotoReady(page, "/");
  await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Juegos del navegador, hechos por la comunidad/ })).toHaveCount(0);

  await loginAndWait(page, VALEN.email, VALEN.password);
  await gotoReady(page, "/");
  await expect(page.getByRole("heading", { name: /Juegos del navegador, hechos por la comunidad/ })).toBeVisible();

  await logout(page);
  await gotoReady(page, "/");
  await expect(page.getByRole("heading", { name: /Juegos del navegador, hechos por la comunidad/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();
});

test("existe en inglés", async ({ page }) => {
  await loginAndWait(page, VALEN.email, VALEN.password);
  await gotoReady(page, "/en");
  await expect(page.getByRole("heading", { level: 1, name: "Browser games, made by the community" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "News from people you follow" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Most played" })).toBeVisible();
});

test("una cuenta nueva, sin seguidos, ve una invitación en lugar de un hueco, y los estantes igual", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(page, { email: `e2e_home_${suffix}@trafal.test`, username: `home_${lettersOnly(suffix)}`, displayName: "Persona Portada" });
  await gotoReady(page, "/");

  await expect(page.getByRole("heading", { level: 1, name: "Juegos del navegador, hechos por la comunidad" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 2, name: "Los más jugados" })).toBeVisible();
  await expect(main.getByText("Todavía no seguís a nadie.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Descubrir creadores" })).toHaveAttribute("href", "/creators");
});

test("quien abre /home sin sesión recibe la portada pública y no queda un hueco", async ({ page }) => {
  await gotoReady(page, "/home");
  await expect(page.getByRole("heading", { name: /Juegos del navegador, hechos por la comunidad/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
