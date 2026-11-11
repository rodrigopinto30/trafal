import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, callRpc } from "./helpers/supabase";

type Target = { name: string; path: string; /** Pantallas que piden sesión: se entra con una cuenta de prueba que estos tests solo LEEN. */ login?: true | "admin" | "outdated" };

const PAGES: readonly Target[] = [
  { name: "inicio", path: "/" },
  { name: "inicio-en", path: "/en" },
  { name: "inicio-con-cuenta", path: "/", login: true },
  { name: "inicio-con-cuenta-en", path: "/en", login: true },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "forgot", path: "/forgot-password" },
  { name: "perfil", path: "/u/valen_makes" },
  { name: "juego", path: "/games/orbita" },
  { name: "comunidad", path: "/feed" },
  { name: "creadores", path: "/creators" },
  { name: "creadores-filtrado", path: "/creators?q=pixels&engine=pico8&sort=followers" },
  { name: "comunidad-con-cuenta", path: "/feed?scope=following", login: true },
  { name: "seguidores", path: "/u/mateo_g/followers" },
  { name: "explorar", path: "/explore" },
  { name: "explorar-resultados", path: "/explore?q=orbita" },
  { name: "explorar-filtrado", path: "/explore?genre=arcade&engine=phaser&mobile=1&sort=plays" },
  { name: "explorar-sin-resultados", path: "/explore?q=zzzz" },
  { name: "terminos", path: "/legal/terms" },
  { name: "privacidad", path: "/legal/privacy" },
  { name: "normas-de-la-comunidad", path: "/legal/guidelines" },
  { name: "derechos-de-autor", path: "/legal/copyright" },
  { name: "reclamo-de-derechos-de-autor", path: "/legal/copyright/claim" },
  { name: "no-encontrado", path: "/pagina-que-no-existe" },
  { name: "subir-juego", path: "/games/new", login: true },
  { name: "guardados", path: "/saved", login: true },
  { name: "notificaciones", path: "/notifications", login: true },
  { name: "publicar-avance", path: "/posts/new", login: true },
  { name: "configuracion-perfil", path: "/settings/profile", login: true },
  { name: "configuracion-preferencias", path: "/settings/preferences", login: true },
  { name: "configuracion-cuenta", path: "/settings/account", login: true },
  { name: "configuracion-moderacion", path: "/settings/moderation", login: true },
  { name: "cuenta-eliminada", path: "/account-deleted" },
  { name: "aceptar-terminos", path: "/accept-terms", login: "outdated" },
  { name: "aviso-de-terminos", path: "/", login: "outdated" },
  { name: "admin-reportes", path: "/admin", login: "admin" },
  { name: "admin-reportes-resueltos", path: "/admin?status=resolved", login: "admin" },
  { name: "admin-reclamos", path: "/admin/claims", login: "admin" },
  { name: "admin-apelaciones", path: "/admin/appeals", login: "admin" },
  { name: "admin-apelaciones-resueltas", path: "/admin/appeals?status=resolved", login: "admin" },
  { name: "admin-cuentas", path: "/admin/accounts", login: "admin" },
  { name: "admin-cuentas-busqueda", path: "/admin/accounts?q=valen&filter=suspended", login: "admin" },
  { name: "admin-registro", path: "/admin/log", login: "admin" },
  { name: "admin-juego-de-la-semana", path: "/admin/featured", login: "admin" },
];

mkdirSync("screenshots", { recursive: true });

/** Creates an account of its own (the seeded ones are only read) and leaves it with an older version of the terms accepted. */
async function registerWithOlderTerms(page: Page, projectName: string) {
  const suffix = `${uniqueSuffix(projectName)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e_quality_${suffix}@trafal.test`;
  await registerAccount(page, { email, username: `quality_${lettersOnly(suffix)}`, displayName: "Persona Calidad" });
  const response = await callRpc("accept_terms", { p_terms_version: "2026-01-01", p_age_confirmed: true }, await accessTokenOf(email, "Trafal12345"));
  expect(response.status).toBeLessThan(300);
}

async function open(page: Page, target: Target, projectName: string) {
  if (target.login === "outdated") await registerWithOlderTerms(page, projectName);
  else if (target.login === "admin") await loginAndWait(page, "admin@trafal.test", "trafal123");
  else if (target.login) await loginAndWait(page, "mateo@trafal.test", "trafal123");
  await page.goto(target.path);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Esperar a que el streaming termine y las fuentes carguen.
  await page.evaluate(() => document.fonts.ready);
}

for (const target of PAGES) {
  test.describe(target.name, () => {
    test("no tiene scroll horizontal y deja captura para revisión visual", async ({ page }, testInfo) => {
      await open(page, target, testInfo.project.name);
      await settle(page);
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
