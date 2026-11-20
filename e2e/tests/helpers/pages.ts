import { expect, type Page, type Response } from "@playwright/test";
import { lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./session";
import { accessTokenOf, callRpc } from "./supabase";

/** Every screen of the site that the quality and W3C checks go through, with the account each one needs. */
export type Target = { name: string; path: string; /** Pantallas que piden sesión: se entra con una cuenta de prueba que estos tests solo LEEN. */ login?: true | "admin" | "outdated" };

export const PAGES: readonly Target[] = [
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
  { name: "creadores-filtrado", path: "/creators?q=pixels&genre=cozy&sort=followers" },
  { name: "comunidad-con-cuenta", path: "/feed?scope=following", login: true },
  { name: "seguidores", path: "/u/mateo_g/followers" },
  { name: "buscar-resultados", path: "/?q=orbita" },
  { name: "buscar-todos", path: "/?sort=recent" },
  { name: "buscar-filtrado", path: "/?genre=arcade&sort=plays" },
  { name: "buscar-sin-resultados", path: "/?q=zzzz" },
  { name: "buscar-con-cuenta", path: "/?genre=arcade", login: true },
  { name: "terminos", path: "/legal/terms" },
  { name: "privacidad", path: "/legal/privacy" },
  { name: "normas-de-la-comunidad", path: "/legal/guidelines" },
  { name: "derechos-de-autor", path: "/legal/copyright" },
  { name: "reclamo-de-derechos-de-autor", path: "/legal/copyright/claim" },
  { name: "guia-subir-juego", path: "/help/upload" },
  { name: "guia-subir-juego-en", path: "/en/help/upload" },
  { name: "no-encontrado", path: "/pagina-que-no-existe" },
  { name: "subir-juego", path: "/games/new", login: true },
  { name: "editar-juego", path: "/games/neon-express/edit", login: true },
  { name: "gestionar-juego", path: "/games/neon-express/manage", login: true },
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
  { name: "admin-cuentas-administracion", path: "/admin/accounts?filter=admins", login: "admin" },
  { name: "admin-registro", path: "/admin/log", login: "admin" },
  { name: "admin-juego-de-la-semana", path: "/admin/featured", login: "admin" },
];

/** Creates an account of its own (the seeded ones are only read) and leaves it with an older version of the terms accepted. */
async function registerWithOlderTerms(page: Page, projectName: string) {
  const suffix = `${uniqueSuffix(projectName)}${Math.random().toString(36).slice(2, 5)}`;
  const email = `e2e_quality_${suffix}@tradfal.test`;
  await registerAccount(page, { email, username: `quality_${lettersOnly(suffix)}`, displayName: "Persona Calidad" });
  const response = await callRpc("accept_terms", { p_terms_version: "2026-01-01", p_age_confirmed: true }, await accessTokenOf(email, "Tradfal12345"));
  expect(response.status).toBeLessThan(300);
}

/** Signs in as the screen needs and opens it; returns the response of the page itself (its HTML as the server sent it). */
export async function openPage(page: Page, target: Target, projectName: string): Promise<Response | null> {
  if (target.login === "outdated") await registerWithOlderTerms(page, projectName);
  else if (target.login === "admin") await loginAndWait(page, "admin@tradfal.test", "tradfal123");
  else if (target.login) await loginAndWait(page, "mateo@tradfal.test", "tradfal123");
  return page.goto(target.path);
}
