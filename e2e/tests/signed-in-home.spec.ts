import { expect, test } from "@playwright/test";
import { gotoReady, loginAndWait, logout, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";

/**
 * The home of someone who is signed in. The address is the same («/»), but the page is another one: a greeting with their name, what
 * is waiting for them, news from the people they follow and no invitation to create an account. Visitors keep the public home.
 */
const VALEN = { email: "valen@trafal.test", password: "trafal123" };

test("quien inició sesión ve su portada en la misma dirección: saludo, su espacio y novedades de a quienes sigue", async ({ page }) => {
  await loginAndWait(page, VALEN.email, VALEN.password);
  await gotoReady(page, "/");
  await expect(page).toHaveURL(/localhost:3000\/$/);

  await expect(page.getByRole("heading", { level: 1, name: "Hola de nuevo, Valentina" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Publicar un avance" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Subir un juego" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Mis guardados" })).toBeVisible();

  await expect(main.getByRole("heading", { level: 3, name: "Tus juegos" })).toBeVisible();
  await expect(main.getByRole("heading", { level: 3, name: "Tu actividad" })).toBeVisible();
  await expect(main.getByText("Seguidores", { exact: true })).toBeVisible();
  await expect(main.getByText("Siguiendo", { exact: true })).toBeVisible();

  await expect(main.getByRole("heading", { level: 2, name: "Novedades de quienes seguís" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Ver todo lo que publican" })).toHaveAttribute("href", "/feed?scope=following");

  await expect(main.getByRole("link", { name: "Crear cuenta" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: /Subí tu juego|Cómo funciona/i })).toHaveCount(0);
  await expect(main.getByRole("heading", { level: 2, name: "Recién publicados" })).toBeVisible();
});

test("la portada pública no cambia para los visitantes, y al cerrar sesión se vuelve a ver", async ({ page }) => {
  await gotoReady(page, "/");
  await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hola de nuevo/ })).toHaveCount(0);

  await loginAndWait(page, VALEN.email, VALEN.password);
  await gotoReady(page, "/");
  await expect(page.getByRole("heading", { name: /Hola de nuevo/ })).toBeVisible();

  await logout(page);
  await gotoReady(page, "/");
  await expect(page.getByRole("heading", { name: /Hola de nuevo/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();
});

test("existe en inglés", async ({ page }) => {
  await loginAndWait(page, VALEN.email, VALEN.password);
  await gotoReady(page, "/en");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back, Valentina" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "News from people you follow" })).toBeVisible();
});

test("una cuenta nueva, sin juegos ni seguidos, ve invitaciones en lugar de huecos", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(page, { email: `e2e_home_${suffix}@trafal.test`, username: `home_${lettersOnly(suffix)}`, displayName: "Persona Portada" });
  await gotoReady(page, "/");

  await expect(page.getByRole("heading", { level: 1, name: "Hola de nuevo, Persona" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByText("Todavía no subiste ningún juego.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Subir mi primer juego" })).toBeVisible();
  await expect(main.getByText("Todavía no seguís a nadie.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Descubrir creadores" })).toHaveAttribute("href", "/creators");
});

test("quien abre /home sin sesión recibe la portada pública y no queda un hueco", async ({ page }) => {
  await gotoReady(page, "/home");
  await expect(page.getByRole("heading", { name: /Hola de nuevo/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
