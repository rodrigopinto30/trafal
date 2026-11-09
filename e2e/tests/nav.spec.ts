import { expect, test } from "@playwright/test";
import { gotoReady, loginAndWait } from "./helpers/session";

/**
 * El menú de arriba es mínimo: además del logo y la cuenta, solo «Explorar», «Creadores», «Comunidad» y «Subir juego». En escritorio van
 * en la barra; en celular, dentro del menú de la hamburguesa. Son los mismos links (salen de nav-config.ts).
 */
async function openNav(page: import("@playwright/test").Page) {
  // En celular el botón dice «Abrir menú» y, ya abierto, «Cerrar menú»: se abre solo si hace falta (así se puede llamar varias veces).
  const open = page.getByRole("button", { name: /Abrir menú|Open menu/ });
  const close = page.getByRole("button", { name: /Cerrar menú|Close menu/ });
  const mobile = (await open.isVisible()) || (await close.isVisible());
  if (await open.isVisible()) await open.click();
  return page.getByRole("navigation", { name: mobile ? /Menú móvil|Mobile menu/ : /Principal|Main/ });
}

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("el menú de arriba tiene solo «Explorar», «Creadores», «Comunidad» y «Subir juego»", async ({ page }) => {
  await gotoReady(page, "/");
  const links = (await openNav(page)).getByRole("link");
  await expect(links).toHaveText(["Explorar", "Creadores", "Comunidad", "Subir juego"]);
  await expect(links.nth(0)).toHaveAttribute("href", "/explore");
  await expect(links.nth(1)).toHaveAttribute("href", "/creators");
  await expect(links.nth(2)).toHaveAttribute("href", "/feed");
  await expect(links.nth(3)).toHaveAttribute("href", "/games/new");
});

test("en inglés son «Explore», «Creators», «Community» y «Upload game»", async ({ page }) => {
  await gotoReady(page, "/en");
  const links = (await openNav(page)).getByRole("link");
  await expect(links).toHaveText(["Explore", "Creators", "Community", "Upload game"]);
  await expect(links.nth(0)).toHaveAttribute("href", "/en/explore");
  await expect(links.nth(1)).toHaveAttribute("href", "/en/creators");
  await expect(links.nth(2)).toHaveAttribute("href", "/en/feed");
  await expect(links.nth(3)).toHaveAttribute("href", "/en/games/new");
});

test("sin cuenta, «Subir juego» pide iniciar sesión y vuelve al formulario después", async ({ page }) => {
  await gotoReady(page, "/");
  await (await openNav(page)).getByRole("link", { name: "Subir juego" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fgames%2Fnew$/);
});

test("cada opción lleva a su pantalla y queda marcada como la actual", async ({ page }) => {
  await loginAndWait(page, "valen@trafal.test", "trafal123");
  await gotoReady(page, "/");
  await (await openNav(page)).getByRole("link", { name: "Subir juego" }).click();
  await expect(page).toHaveURL(/\/games\/new$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Subir un juego");
  await expect((await openNav(page)).getByRole("link", { name: "Subir juego" })).toHaveAttribute("aria-current", "page");

  await (await openNav(page)).getByRole("link", { name: "Comunidad" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect((await openNav(page)).getByRole("link", { name: "Comunidad" })).toHaveAttribute("aria-current", "page");
  await expect((await openNav(page)).getByRole("link", { name: "Subir juego" })).not.toHaveAttribute("aria-current", "page");

  await (await openNav(page)).getByRole("link", { name: "Creadores" }).click();
  await expect(page).toHaveURL(/\/creators$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Creadores");
  await expect((await openNav(page)).getByRole("link", { name: "Creadores" })).toHaveAttribute("aria-current", "page");

  await (await openNav(page)).getByRole("link", { name: "Explorar" }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Explorar juegos");
  await expect((await openNav(page)).getByRole("link", { name: "Explorar" })).toHaveAttribute("aria-current", "page");
  await expect((await openNav(page)).getByRole("link", { name: "Creadores" })).not.toHaveAttribute("aria-current", "page");
});

test("la sección de arriba sigue marcada al filtrar o buscar dentro de ella", async ({ page }) => {
  await gotoReady(page, "/explore?genre=arcade&sort=plays");
  await expect((await openNav(page)).getByRole("link", { name: "Explorar" })).toHaveAttribute("aria-current", "page");
  await gotoReady(page, "/creators?q=sofi");
  await expect((await openNav(page)).getByRole("link", { name: "Creadores" })).toHaveAttribute("aria-current", "page");
});

test("al cambiar de pantalla la barra no se mueve (aunque una tenga barra de scroll y otra no)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "En celular las barras de scroll no ocupan lugar");
  await gotoReady(page, "/");
  const bar = page.locator("header > div").first();
  const before = await bar.boundingBox();
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Comunidad" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  const after = await bar.boundingBox();
  expect(after?.x).toBe(before?.x);
  expect(after?.width).toBe(before?.width);
});
