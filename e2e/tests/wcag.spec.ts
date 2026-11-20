import { expect, test, type Page } from "@playwright/test";
import { gotoReady, loginAndWait } from "./helpers/session";
import { PAGES, openPage } from "./helpers/pages";

/**
 * What WCAG 2.2 AA asks that the automatic audit (axe, in quality.spec.ts) cannot see: the page reflows at 320 px (zoom to 400 %),
 * it survives wider text spacing, the keyboard focus is always visible and never hidden behind the sticky bar nor trapped, and
 * nothing keeps moving for someone who asked for less motion.
 */

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

const overflowsSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

for (const target of PAGES) {
  test.describe(target.name, () => {
    test("a 320 px de ancho (zoom al 400 %) se lee sin scroll horizontal (1.4.10)", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile-360", "Se mide una vez, en el tamaño de celular");
      await page.setViewportSize({ width: 320, height: 640 });
      await openPage(page, target, testInfo.project.name);
      await settle(page);
      expect(await overflowsSideways(page), "ancho del documento vs. 320 px").toBe(false);
    });

    test("con más espaciado de texto no se pierde contenido ni aparece scroll horizontal (1.4.12)", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "Se mide una vez, en escritorio");
      await openPage(page, target, testInfo.project.name);
      await settle(page);
      await page.addStyleTag({
        content: "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }",
      });
      expect(await overflowsSideways(page), "scroll horizontal con más espaciado").toBe(false);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("button, a[href], [role=button], label")]
          .filter((element) => element.offsetParent !== null && element.innerText.trim() !== "")
          .filter((element) => !element.closest(".sr-only, .truncate, [class*='line-clamp']"))
          .filter((element) => {
            const style = getComputedStyle(element);
            const hides = ["hidden", "clip"].includes(style.overflowX) || ["hidden", "clip"].includes(style.overflowY);
            return hides && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
          })
          .map((element) => element.innerText.trim().slice(0, 40)),
      );
      expect(clipped, "controles con el texto cortado").toEqual([]);
    });
  });
}

/** Walks the page with the keyboard and describes each stop: whether the focus is visible and whether the sticky bar covers it. */
async function walkWithKeyboard(page: Page, presses: number, key = "Tab") {
  const stops: { name: string; visible: boolean; covered: boolean }[] = [];
  for (let press = 0; press < presses; press += 1) {
    await page.keyboard.press(key);
    stops.push(
      await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body || element.tagName === "NEXTJS-PORTAL") return { name: "body", visible: true, covered: false };
        const drawn = (style: CSSStyleDeclaration) => (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
        const ring = drawn(getComputedStyle(element)) || drawn(getComputedStyle(element, "::after")) || drawn(getComputedStyle(element, "::before"));
        const rect = element.getBoundingClientRect();
        const onTop = document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 8));
        const covered = !!onTop && !element.contains(onTop) && !element.closest("header.sticky") && !!onTop.closest("header.sticky");
        const label = element.getAttribute("aria-label") ?? element.innerText ?? element.tagName;
        return { name: `${element.tagName.toLowerCase()} «${label.trim().slice(0, 30)}»`, visible: ring, covered };
      }),
    );
  }
  return stops;
}

const KEYBOARD_PAGES = ["/", "/games/orbita", "/legal/terms", "/feed", "/help/upload"];

for (const path of KEYBOARD_PAGES) {
  test(`${path}: con el teclado el foco siempre se ve, nunca queda tapado por la barra fija y no hay trampas (2.4.7, 2.4.11, 2.1.2)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Recorrido con teclado de escritorio");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, path);
    await settle(page);
    const forward = await walkWithKeyboard(page, 45);
    const backward = await walkWithKeyboard(page, 20, "Shift+Tab");
    const stops = [...forward, ...backward].filter((stop) => stop.name !== "body");

    expect(stops.filter((stop) => !stop.visible).map((stop) => stop.name), "sin foco visible").toEqual([]);
    expect(stops.filter((stop) => stop.covered).map((stop) => stop.name), "tapados por la barra").toEqual([]);
    const repeated = forward.some((stop, index) => index >= 2 && stop.name !== "body" && stop.name === forward[index - 1]?.name && stop.name === forward[index - 2]?.name);
    expect(repeated, "el foco quedó trabado en un mismo lugar").toBe(false);
  });
}

for (const path of ["/legal/terms", "/help/upload"]) {
  test(`${path}: cada enlace del índice deja su sección a la vista, debajo de la barra fija (2.4.11)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Se mide una vez");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, path);
    const links = page.locator('main a[href^="#"]');
    const count = await links.count();
    expect(count, "el índice tiene enlaces").toBeGreaterThan(2);
    const hidden: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const link = links.nth(index);
      const id = (await link.getAttribute("href"))!.slice(1);
      await link.click();
      await page.waitForFunction((target) => location.hash === `#${target}`, id);
      const tucked = await page.evaluate((target) => {
        const bar = document.querySelector("header.sticky")!.getBoundingClientRect();
        const heading = document.getElementById(target)!.querySelector("h2, h3") ?? document.getElementById(target)!;
        return heading.getBoundingClientRect().top < bar.bottom;
      }, id);
      if (tucked) hidden.push(id);
    }
    expect(hidden, "secciones que quedan debajo de la barra").toEqual([]);
  });
}

test("quien pidió menos movimiento no ve nada animándose solo (2.3.3)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Se mide una vez");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/games/orbita", "/feed"]) {
    await gotoReady(page, path);
    await settle(page);
    await page.waitForTimeout(200);
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .map((animation) => (animation as CSSAnimation).animationName ?? "animación"),
    );
    expect(running, path).toEqual([]);
  }
});

test("los avisos de éxito se anuncian a los lectores de pantalla (4.1.3)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Se mide una vez");
  await loginAndWait(page, "valen@tradfal.test", "tradfal123");
  await gotoReady(page, "/settings/profile");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  const announced = page.locator("[aria-live]").getByText("¡Cambios guardados!");
  await expect(announced).toBeVisible();
});

test("iniciar sesión no pide resolver nada de memoria: el navegador puede completar y pegar (3.3.8)", async ({ page }) => {
  await gotoReady(page, "/login");
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await page.getByLabel("Contraseña", { exact: true }).focus();
  await page.evaluate(() => {
    const field = document.activeElement as HTMLInputElement;
    const data = new DataTransfer();
    data.setData("text/plain", "pegada123");
    const allowed = field.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    if (!allowed) throw new Error("the password field blocks pasting");
  });
});
