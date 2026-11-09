import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, defaultLocale, isLocale, negotiateLocale, type Locale } from "@/i18n/config";
import { localizePath, stripLocale } from "@/i18n/path";
import { updateSession } from "@/lib/supabase/proxy";

const ONE_YEAR = 60 * 60 * 24 * 365;

function rememberLocale(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE, locale, { maxAge: ONE_YEAR, path: "/", sameSite: "lax" });
}

/**
 * 1) Idioma. El español va sin prefijo (/login) y el inglés con /en (/en/login). Toda ruta vive bajo app/[lang],
 *    así que /login se REESCRIBE a /es/login. La elección se recuerda en una cookie; sin cookie se usa Accept-Language.
 * 2) Sesión. Renueva el token de Supabase para que los Server Components lo vean actualizado.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale: urlLocale, path } = stripLocale(pathname);

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
    const response = await updateSession(request, () => NextResponse.next({ request }));
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

  const rewritten = request.nextUrl.clone();
  rewritten.pathname = `/${defaultLocale}${path === "/" ? "" : path}`;
  return updateSession(request, () => NextResponse.rewrite(rewritten, { request }));
}

export const config = {
  // Todo menos archivos estáticos, /auth (rutas de confirmación, sin idioma) y /api.
  // Ojo: NO se excluyen rutas por extensión, porque hay @usuarios con punto (/u/agus.codes).
  matcher: [
    "/((?!_next/|cursors/|auth/|api/|icon\\.svg|apple-icon|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest).*)",
  ],
};
