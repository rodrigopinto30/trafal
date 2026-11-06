import { expect, test, type Page } from "@playwright/test";
import { gotoReady, loginAndWait } from "./helpers/session";

/**
 * Al abrir o cerrar el menú de la cuenta, la página no se mueve (ni la barra de arriba, ni el contenido, ni el scroll) y la
 * barra de scroll del navegador sigue ahí, sin bloqueo de scroll. Se mide con barras reales (las de escritorio ocupan lugar;
 * las de celular, no).
 */
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

type Layout = { header: DOMRect | null; content: DOMRect | null; scrollY: number; viewportWidth: number; scrollLocked: boolean };

async function measure(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const rect = (element: Element | null) => (element ? element.getBoundingClientRect().toJSON() : null);
    return {
      header: rect(document.querySelector("header > div")),
      content: rect(document.querySelector("main h1, main h2")),
      scrollY: Math.round(window.scrollY),
      viewportWidth: document.documentElement.clientWidth,
      scrollLocked: document.body.hasAttribute("data-scroll-locked"),
    };
  });
}

function expectSameLayout(actual: Layout, expected: Layout) {
  expect(actual.header?.x).toBe(expected.header?.x);
  expect(actual.header?.width).toBe(expected.header?.width);
  expect(actual.content?.x).toBe(expected.content?.x);
  expect(actual.content?.width).toBe(expected.content?.width);
  expect(actual.content?.y).toBe(expected.content?.y);
  expect(actual.scrollY).toBe(expected.scrollY);
  expect(actual.viewportWidth, "la barra de scroll sigue ocupando el mismo lugar").toBe(expected.viewportWidth);
  expect(actual.scrollLocked, "el menú no bloquea el scroll de la página").toBe(false);
}

for (const path of ["/", "/settings/profile", "/u/valen_makes"]) {
  test(`el menú de la cuenta no mueve la página (${path})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "En celular las barras de scroll no ocupan lugar");
    await loginAndWait(page, "valen@trafal.test", "trafal123");
    await gotoReady(page, path);
    if (path === "/") await page.evaluate(() => window.scrollTo(0, 400));
    const before = await measure(page);

    await page.getByRole("button", { name: "Tu cuenta" }).click();
    await expect(page.getByRole("menuitem", { name: "Mi perfil" })).toBeVisible();
    expectSameLayout(await measure(page), before);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "Mi perfil" })).toBeHidden();
    expectSameLayout(await measure(page), before);
  });
}

test("con el menú abierto la página sigue pudiendo scrollearse y el menú se cierra al tocar afuera", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "En celular las barras de scroll no ocupan lugar");
  await loginAndWait(page, "valen@trafal.test", "trafal123");
  await gotoReady(page, "/");
  await page.getByRole("button", { name: "Tu cuenta" }).click();
  await expect(page.getByRole("menuitem", { name: "Mi perfil" })).toBeVisible();
  await page.mouse.move(400, 500);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0);

  await page.mouse.click(30, 300);
  await expect(page.getByRole("menuitem", { name: "Mi perfil" })).toBeHidden();
});
