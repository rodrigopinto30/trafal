import { expect, test } from "@playwright/test";
import { gotoReady, loginWith, registerAccount, uniqueSuffix } from "./helpers/session";

test.describe("idioma", () => {
  test("no hay selector de idioma en ninguna parte: ni en la barra, ni en el menú, ni en el pie", async ({ page }) => {
    await gotoReady(page, "/");
    const burger = page.getByRole("button", { name: "Abrir menú" });
    if (await burger.isVisible()) await burger.click();

    await expect(page.locator("a[hreflang]")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Idioma" })).toHaveCount(0);
    await expect(page.getByText(/Cambiar el idioma|Switch language/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^(es|en) — / })).toHaveCount(0);
  });

  test("el idioma sale del sistema: español, inglés, y español si es un idioma que no tenemos", async ({ browser }) => {
    const cases = [
      { acceptLanguage: "es-AR,es;q=0.9", url: /localhost:3000\/explore$/, heading: "Explorar juegos", lang: "es" },
      { acceptLanguage: "en-US,en;q=0.9", url: /\/en\/explore$/, heading: "Explore games", lang: "en" },
      { acceptLanguage: "en-GB,en;q=0.9,es;q=0.8", url: /\/en\/explore$/, heading: "Explore games", lang: "en" },
      { acceptLanguage: "fr-FR,fr;q=0.9", url: /localhost:3000\/explore$/, heading: "Explorar juegos", lang: "es" },
    ];
    for (const item of cases) {
      const context = await browser.newContext({ locale: item.acceptLanguage.split(",")[0], extraHTTPHeaders: { "Accept-Language": item.acceptLanguage } });
      const page = await context.newPage();
      await page.goto("/explore");
      await expect(page, item.acceptLanguage).toHaveURL(item.url);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.heading);
      await expect(page.locator("html")).toHaveAttribute("lang", item.lang);
      await context.close();
    }
  });

  test("«/es/…» es la forma explícita del español y redirige a la URL canónica", async ({ page }) => {
    await page.goto("/es/login");
    await expect(page).toHaveURL(/localhost:3000\/login$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Volvé a entrar");
  });

  test("se cambia desde Configuración, se guarda en la cuenta y vale en otros dispositivos", async ({ page, browser }, testInfo) => {
    test.setTimeout(150_000);
    const suffix = uniqueSuffix(testInfo.project.name);
    const email = `e2e_${suffix}@trafal.test`;
    await registerAccount(page, { email, username: `e2e_${suffix}`, displayName: "Idioma de Prueba" });

    // Español (el del navegador) → inglés, desde Configuración → Preferencias.
    await gotoReady(page, "/settings/preferences");
    await expect(page.getByRole("heading", { level: 2, name: "Preferencias" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Español" })).toBeChecked();
    await page.getByText("English", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar preferencias" }).click();

    await expect(page).toHaveURL(/\/en\/settings\/preferences$/);
    await expect(page.getByRole("heading", { level: 2, name: "Preferences" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("radio", { name: "English" })).toBeChecked();

    // Queda recordado: entrar a «/» sin prefijo lleva al inglés.
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Publish your game.");

    // Otro dispositivo (navegador SIN cookies y en español): al iniciar sesión se usa el idioma de la CUENTA.
    const otherDevice = await browser.newContext({ locale: "es-AR", extraHTTPHeaders: { "Accept-Language": "es-AR,es;q=0.9" } });
    const other = await otherDevice.newPage();
    await loginWith(other, email, "Trafal12345");
    await expect(other).toHaveURL(/\/en$/);
    await expect(other.getByRole("heading", { level: 1 })).toContainText("Publish your game.");
    await otherDevice.close();

    // Y de vuelta a español: la URL pierde el prefijo.
    await gotoReady(page, "/en/settings/preferences");
    await page.getByText("Español", { exact: true }).click();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page).toHaveURL(/localhost:3000\/settings\/preferences$/);
    await expect(page.getByRole("heading", { level: 2, name: "Preferencias" })).toBeVisible();
  });

  test("las preferencias piden iniciar sesión", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fpreferences/);
  });
});
