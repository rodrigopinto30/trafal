import { expect, test, type Page } from "@playwright/test";
import { gotoReady, loginAndWait } from "./helpers/session";

/**
 * Al abrir o cerrar el menú de la cuenta, la página no se mueve: ni la barra de arriba, ni el contenido, ni el scroll.
 * Se mide con barras de scroll reales (las de escritorio ocupan lugar; las de celular, no).
 */
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

type Layout = { header: DOMRect | null; content: DOMRect | null; scrollY: number };

async function measure(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const rect = (element: Element | null) => (element ? element.getBoundingClientRect().toJSON() : null);
    return {
      header: rect(document.querySelector("header > div")),
      content: rect(document.querySelector("main h1, main h2")),
      scrollY: Math.round(window.scrollY),
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
