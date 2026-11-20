import { type Locale, defaultLocale, isLocale } from "./config";

/**
 * Rutas con idioma. El idioma por defecto (es) NO lleva prefijo: "/login" es español, "/en/login" es inglés.
 * Internamente toda ruta vive bajo app/[lang]; el proxy reescribe "/login" → "/es/login".
 *
 * Este módulo no depende de React ni de Next: lo usan el proxy, el servidor y el navegador.
 */

/** Separa "?query#hash" del path. */
function splitSuffix(href: string): { path: string; suffix: string } {
  const index = href.search(/[?#]/);
  return index === -1 ? { path: href, suffix: "" } : { path: href.slice(0, index), suffix: href.slice(index) };
}

/** Quita el prefijo de idioma si lo hay: "/en/login" → { locale: "en", path: "/login" }. */
export function stripLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first = "", ...rest] = pathname.split("/");
  if (isLocale(first)) {
    return { locale: first, path: "/" + rest.join("/") };
  }
  return { locale: null, path: pathname || "/" };
}

/**
 * Ruta pública para un idioma. `explicit` fuerza el prefijo también en el idioma por defecto
 * ("/es/login"): el selector de idioma lo usa para que elegir español quede recordado.
 */
export function localizePath(locale: Locale, href: string, options: { explicit?: boolean } = {}): string {
  const { path, suffix } = splitSuffix(href);
  const clean = stripLocale(path).path;
  const normalized = `/${clean.replace(/^[/\\]+/, "")}`;

  if (locale === defaultLocale && !options.explicit) {
    return normalized + suffix;
  }
  return (normalized === "/" ? `/${locale}` : `/${locale}${normalized}`) + suffix;
}

/**
 * Solo rutas internas "seguras" para usar como destino (?next=...): evita redirecciones abiertas. "//evil.com" y "/\\evil.com" son
 * direcciones de otro sitio para el navegador, también después de sacarles el idioma ("/en//evil.com"), así que la ruta no puede
 * tener barras invertidas ni dos barras seguidas, y los caracteres de control (que permitirían inyectar cabeceras) tampoco.
 */
export function isInternalPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  const { path } = splitSuffix(value);
  if (path.includes("\\") || path.includes("//")) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return true;
}
