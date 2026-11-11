import { expect, test, type Page } from "@playwright/test";
import { gotoReady, loginAndWait } from "./helpers/session";

/**
 * El cursor solo existe con mouse: en el celular (pantalla táctil) la regla no aplica y no hay nada que comprobar.
 * Acá se mira el cursor REAL (el que calcula el navegador), no el CSS: es lo único que prueba que ninguna clase de un
 * componente (por ejemplo el `cursor-default` que traía el menú de shadcn) le gane a la regla global.
 */
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "El cursor solo existe con mouse");
});

const CLICKABLE = [
  "a[href]",
  "button:not(:disabled)",
  "select:not(:disabled)",
  "summary",
  "label[for]",
  "label:has(input[type=checkbox])",
  "label:has(input[type=radio])",
  "input[type=checkbox]:not(:disabled)",
  "input[type=radio]:not(:disabled)",
  "input[type=range]",
  "input[type=file]",
  "[role=button]",
  "[role=tab]",
  "[role=menuitem]",
  "[role=checkbox]",
  "[role=switch]",
  "[role=option]",
].join(",");

/** Todo elemento clickeable VISIBLE cuyo cursor no sea la manito, con una descripción para el mensaje de error. */
async function clickablesWithoutPointer(page: Page) {
  return page.evaluate((selector) => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.getClientRects().length === 0 || el.closest("[hidden]")) continue; // no se ve: no se puede apuntar con el mouse
      const cursor = getComputedStyle(el).cursor;
      if (cursor !== "pointer") {
        const name = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
        bad.push(`${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""} «${name}» → ${cursor}`);
      }
    }
    return bad;
  }, CLICKABLE);
}

const PUBLIC_PAGES = ["/", "/login", "/signup", "/forgot-password", "/u/valen_makes", "/games/orbita", "/u/mateo_g/followers", "/?genre=arcade", "/legal/terms", "/en"];

for (const path of PUBLIC_PAGES) {
  test(`todo lo clickeable muestra la manito en ${path}`, async ({ page }) => {
    await gotoReady(page, path);
    expect(await clickablesWithoutPointer(page)).toEqual([]);
  });
}

test("la manito también está en la configuración, el menú de la cuenta, las pestañas y el diálogo de la foto", async ({ page }) => {
  await loginAndWait(page, "mateo@trafal.test", "trafal123");
  await expect(page.getByRole("button", { name: "Tu cuenta" })).toBeVisible();

  await gotoReady(page, "/settings/profile");
  expect(await clickablesWithoutPointer(page)).toEqual([]);
  // Los chips de motores y las baldosas de géneros son <label> sin «for» que envuelven una casilla.
  for (const label of ["Godot", "Plataformas", "Arcade"]) {
    const cursor = await page.getByText(label, { exact: true }).evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor, label).toBe("pointer");
  }

  await gotoReady(page, "/settings/preferences");
  expect(await clickablesWithoutPointer(page)).toEqual([]);

  // Menú desplegable de la cuenta: los ítems son role=menuitem.
  await page.getByRole("button", { name: "Tu cuenta" }).click();
  await expect(page.getByRole("menuitem", { name: "Configuración" })).toBeVisible();
  expect(await clickablesWithoutPointer(page)).toEqual([]);
  await page.keyboard.press("Escape");

  // Pestañas del perfil (Radix Tabs).
  await gotoReady(page, "/u/mateo_g");
  expect((await page.getByRole("tab").evaluateAll((tabs) => tabs.map((tab) => getComputedStyle(tab).cursor))).every((cursor) => cursor === "pointer")).toBe(true);

  // Diálogo de la foto: botones, zoom y el cierre.
  await gotoReady(page, "/settings/profile");
  const { makePng } = await import("./helpers/images");
  await page.getByTestId("avatar-file").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: makePng(300, 300) });
  await expect(page.getByRole("dialog", { name: "Ajustá tu foto" })).toBeVisible();
  expect(await clickablesWithoutPointer(page)).toEqual([]);
});

test("lo deshabilitado muestra «no permitido», el texto el cursor de texto y el resto la flecha propia", async ({ page }) => {
  await gotoReady(page, "/login");
  const cursors = await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<button id="x-button" disabled>x</button><label id="x-label"><input type="checkbox" disabled>x</label><span id="x-aria" role="button" aria-disabled="true">x</span>',
    );
    const read = (selector: string) => getComputedStyle(document.querySelector(selector) as Element).cursor;
    return {
      button: read("#x-button"),
      label: read("#x-label"),
      aria: read("#x-aria"),
      email: read("input[name=email]"),
      body: read("body"),
    };
  });
  expect(cursors.button).toBe("not-allowed");
  expect(cursors.label).toBe("not-allowed");
  expect(cursors.aria).toBe("not-allowed");
  expect(cursors.email).toBe("text");
  expect(cursors.body).toContain("arrow.svg"); // la flecha pixelada de la marca
});
