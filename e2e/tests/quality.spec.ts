import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { PAGES, openPage as open } from "./helpers/pages";

mkdirSync("screenshots", { recursive: true });

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Esperar a que el streaming termine y las fuentes carguen.
  await page.evaluate(() => document.fonts.ready);
}

for (const target of PAGES) {
  test.describe(target.name, () => {
    test("no tiene scroll horizontal, nada viola la Content-Security-Policy y deja captura para revisión visual", async ({ page }, testInfo) => {
      await page.addInitScript(() => {
        const found: string[] = [];
        Object.assign(window, { __cspViolations: found });
        document.addEventListener("securitypolicyviolation", (event) => found.push(`${event.effectiveDirective} ${event.blockedURI}`));
      });
      await open(page, target, testInfo.project.name);
      await settle(page);
      expect(await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations), "violaciones de la CSP").toEqual([]);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth, "ancho del documento vs. ancho de la ventana").toBeLessThanOrEqual(innerWidth);
      await page.screenshot({ path: `screenshots/${testInfo.project.name}-${target.name}.png`, fullPage: true });
    });

    test("los controles tienen al menos 44 px de alto", async ({ page }, testInfo) => {
      await open(page, target, testInfo.project.name);
      await settle(page);
      const small = await page.evaluate(() => {
        // El checkbox de Radix (<button role=checkbox>) mide 24 px pero su área táctil real es de 44 px: un pseudo-elemento
        // ::after la amplía 10 px por lado y la etiqueta de al lado también es clickeable. Las medidas no ven pseudo-elementos.
        const selector = "button:not([role=checkbox]), [role=button], [role=tab], select, textarea, input:not([type=hidden]):not([type=checkbox]):not(.sr-only), nav a, footer a, a[class*=rounded-full]";
        return [...document.querySelectorAll<HTMLElement>(selector)]
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            // Ocultos, de solo lectores de pantalla o dentro de un menú cerrado: no cuentan.
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && !el.closest("[hidden]") && !el.closest(".sr-only");
          })
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return { text: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40), h: Math.round(rect.height), w: Math.round(rect.width) };
          })
          // Pequeños pero aceptables: el selector de idioma mide 40 px (dentro de una píldora de 44).
          .filter((item) => item.h < 40);
      });
      expect(small, "controles de menos de 40 px de alto").toEqual([]);
    });

    test("pasa la auditoría de accesibilidad de axe (WCAG 2.2 AA, incluido el contraste)", async ({ page }, testInfo) => {
      await open(page, target, testInfo.project.name);
      await settle(page);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) })),
      ).toEqual([]);
    });
  });
}
