import { expect, test, type Page } from "@playwright/test";
import { gotoReady } from "./helpers/session";

/**
 * El buscador de juegos de la portada: está arriba de todo, sugiere mientras se escribe, se maneja con el teclado y lleva a
 * los resultados (/?q=…). Los juegos son los de ejemplo del seed.
 */
function searchBox(page: Page) {
  return page.getByRole("combobox", { name: /Buscar juegos|Search games/ });
}

test.describe("buscador de la portada", () => {
  test("está al inicio de la portada: a la vista sin scrollear y antes de las secciones de juegos", async ({ page }) => {
    await gotoReady(page, "/");
    const form = page.getByRole("search", { name: "Buscar juegos" });
    await expect(form).toBeVisible();
    const box = await form.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.y + box.height <= viewport.height, "el buscador entra en la primera pantalla").toBe(true);
    const firstSection = await page.getByRole("heading", { name: "Recién publicados" }).boundingBox();
    expect(box && firstSection && box.y < firstSection.y).toBe(true);
    await expect(page.getByRole("button", { name: "Buscar", exact: true })).toBeVisible();
  });

  test("sugiere mientras se escribe, ignorando tildes y mayúsculas, y se elige con el teclado", async ({ page }) => {
    await gotoReady(page, "/");
    const input = searchBox(page);
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await input.fill("ORB");
    const options = page.getByRole("listbox", { name: "Sugerencias" }).getByRole("option");
    await expect(options.first()).toContainText("Órbita");
    await expect(options.first()).toContainText("de ");
    await expect(options.last()).toContainText("Ver todos los resultados de «ORB»");
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("status").filter({ hasText: "sugerencia" })).toBeVisible();

    await input.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute("aria-activedescendant", /option-0$/);
    await input.press("Enter");
    await expect(page).toHaveURL(/\/games\/orbita$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Órbita");
  });

  test("Escape cierra las sugerencias y las flechas dan la vuelta hasta el campo", async ({ page }) => {
    await gotoReady(page, "/");
    const input = searchBox(page);
    await input.fill("gato");
    const options = page.getByRole("option");
    await expect(options.first()).toContainText("Gato Láser");
    await input.press("ArrowUp");
    await expect(options.last()).toHaveAttribute("aria-selected", "true");
    await input.press("ArrowDown");
    await expect(input).not.toHaveAttribute("aria-activedescendant", /.+/);
    await input.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(input).toHaveValue("gato");
  });

  test("al enviar lleva a los resultados con el texto en la dirección", async ({ page }) => {
    await gotoReady(page, "/");
    await searchBox(page).fill("láser");
    await searchBox(page).press("Enter");
    await expect(page).toHaveURL(/\/\?q=l%C3%A1ser$/);
    await expect(page.getByRole("heading", { level: 2, name: "Resultados para «láser»" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toContainText("Gato Láser");
    await expect(searchBox(page)).toHaveValue("láser");
    await expect(page.getByText("1 juego")).toBeVisible();
  });

  test("el botón Buscar y un campo vacío llevan a todos los juegos", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/\/\?sort=recent$/);
    await expect(page.getByRole("heading", { level: 2, name: "Todos los juegos publicados, los más nuevos primero." })).toBeVisible();
    expect(await page.getByRole("article").count()).toBeGreaterThanOrEqual(8);
  });

  test("sin coincidencias lo dice y ofrece ver todos los juegos", async ({ page }) => {
    await gotoReady(page, "/?q=zzzzzz");
    await expect(page.getByRole("heading", { name: "No encontramos juegos para «zzzzzz»" })).toBeVisible();
    await page.getByRole("link", { name: "Ver todos los juegos" }).click();
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });

  test("lo que se escribe es texto: nunca se interpreta como HTML ni rompe la búsqueda", async ({ page }) => {
    const alerts: string[] = [];
    page.on("dialog", async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });
    await gotoReady(page, "/");
    const evil = `<img src=x onerror=alert(1)> "' & | ! : * ( ) \\`;
    await searchBox(page).fill(evil);
    await searchBox(page).press("Enter");
    await expect(page).toHaveURL(/\/\?q=/);
    await expect(page.getByRole("heading", { name: /No encontramos juegos/ })).toBeVisible();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
    expect(alerts).toEqual([]);
  });

  test("un texto larguísimo se recorta y no rompe la pantalla", async ({ page }) => {
    await gotoReady(page, `/?q=${"a".repeat(3000)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buscar juegos");
    expect(await searchBox(page).inputValue()).toHaveLength(80);
  });

  test("en inglés todo queda en inglés y los links conservan el idioma", async ({ page }) => {
    await gotoReady(page, "/en");
    await expect(page.getByRole("search", { name: "Search games" })).toBeVisible();
    await searchBox(page).fill("orb");
    await expect(page.getByRole("option").first()).toContainText("by ");
    await expect(page.getByRole("option").last()).toContainText("See all results for “orb”");
    await searchBox(page).press("Enter");
    await expect(page).toHaveURL(/\/en\?q=orb$/);
    await expect(page.getByRole("heading", { level: 2, name: "Results for “orb”" })).toBeVisible();
    await expect(page.getByRole("article")).toContainText("Órbita");
  });

  test("sin JavaScript el formulario igual envía la búsqueda a la portada", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("combobox", { name: "Buscar juegos" }).fill("orbita");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page).toHaveURL(/\/\?q=orbita$/);
    await context.close();
  });
});
