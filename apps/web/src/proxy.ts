import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, defaultLocale, isLocale, negotiateLocale, type Locale } from "@/i18n/config";
import { localizePath, stripLocale } from "@/i18n/path";
import { updateSession } from "@/lib/supabase/proxy";
import { EXPLORE_PARAMS } from "@/lib/validation/explore";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Dónde vive la portada dinámica (una ruta propia: la de los visitantes sigue estática y no cambia). La sirven, en la dirección «/»,
 * quien inició sesión y cualquiera que pida una búsqueda (`/?q=…`, `/?genre=…`).
 */
const DYNAMIC_HOME = "/home";

function asksForSearch(request: NextRequest): boolean {
  return EXPLORE_PARAMS.some((name) => request.nextUrl.searchParams.has(name));
}

function rememberLocale(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE, locale, { maxAge: ONE_YEAR, path: "/", sameSite: "lax" });
}

/**
 * 1) Idioma. El español va sin prefijo (/login) y el inglés con /en (/en/login). Toda ruta vive bajo app/[lang],
 *    así que /login se REESCRIBE a /es/login. La elección se recuerda en una cookie; sin cookie se usa Accept-Language.
 * 2) Sesión. Renueva el token de Supabase para que los Server Components lo vean actualizado.
 * 3) Portada. «/» (o «/en») se REESCRIBE a la portada dinámica si hay una sesión válida o si la dirección pide una búsqueda; el
 *    navegador sigue viendo la misma dirección y quien no inició sesión ni busca recibe la portada estática de siempre.
 * 4) «/explore» (la antigua pantalla de búsqueda) redirige para siempre a la portada, con la misma búsqueda.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale: urlLocale, path } = stripLocale(pathname);

  if (path === "/explore") {
    const url = request.nextUrl.clone();
    url.pathname = urlLocale && urlLocale !== defaultLocale ? localizePath(urlLocale, "/") : "/";
    return NextResponse.redirect(url, 308);
  }

  // «/es/algo» es la forma explícita del idioma por defecto: se manda a la URL canónica y se recuerda la elección.
  if (urlLocale === defaultLocale) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const response = NextResponse.redirect(url);
    rememberLocale(response, defaultLocale);
    return response;
  }

  // «/en/algo»: idioma explícito, se sigue de largo.
  if (urlLocale) {
    const response = await updateSession(request, (signedIn) => {
      if (!(path === "/" && (signedIn || asksForSearch(request)))) return NextResponse.next({ request });
      const home = request.nextUrl.clone();
      home.pathname = localizePath(urlLocale, DYNAMIC_HOME);
      return NextResponse.rewrite(home, { request });
    });
    rememberLocale(response, urlLocale);
    return response;
  }

  // Sin prefijo: ¿qué idioma prefiere esta persona?
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(remembered) ? remembered : negotiateLocale(request.headers.get("accept-language"));

  if (locale !== defaultLocale) {
    const url = request.nextUrl.clone();
    url.pathname = localizePath(locale, path);
    const response = NextResponse.redirect(url);
    rememberLocale(response, locale);
    return response;
  }

  return updateSession(request, (signedIn) => {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = `/${defaultLocale}${path === "/" ? (signedIn || asksForSearch(request) ? DYNAMIC_HOME : "") : path}`;
    return NextResponse.rewrite(rewritten, { request });
  });
}

export const config = {
  // Todo menos archivos estáticos, /auth (rutas de confirmación, sin idioma) y /api.
  // Ojo: NO se excluyen rutas por extensión, porque hay @usuarios con punto (/u/agus.codes).
  matcher: [
    "/((?!_next/|cursors/|auth/|api/|icon\\.svg|apple-icon|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest).*)",
  ],
};
