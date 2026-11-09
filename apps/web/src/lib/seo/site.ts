import { locales, type Locale } from "@/i18n/config";
import { localizePath } from "@/i18n/path";
import { publicEnv } from "@/lib/env";

export const SITE_NAME = "Trafal";

/** The full public address of a page in a language (`/games/orbita` in English is `https://…/en/games/orbita`). */
export function absoluteUrl(locale: Locale, path: string, siteUrl: string = publicEnv.siteUrl): string {
  return new URL(localizePath(locale, path), siteUrl).toString();
}

/** The same page in every language, with the default one (Spanish) as the fallback for people whose language is not covered. */
export function languageAlternates(path: string, siteUrl: string = publicEnv.siteUrl): Record<string, string> {
  const languages: Record<string, string> = Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(locale, path, siteUrl)]));
  languages["x-default"] = absoluteUrl("es", path, siteUrl);
  return languages;
}

const PRIVATE_HOSTS = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$|\.(local|localhost|test|internal)$/i;

/**
 * Whether the site is reachable by the public. A development or staging copy (localhost, a `.local` or `.test` name, an address
 * on the machine) must never be indexed: robots.txt closes it completely.
 */
export function isPublicSite(siteUrl: string = publicEnv.siteUrl): boolean {
  try {
    return !PRIVATE_HOSTS.test(new URL(siteUrl).hostname);
  } catch {
    return false;
  }
}

/** A text cut at a word boundary to fit a snippet, with an ellipsis if it was cut. Line breaks and repeated spaces become single spaces. */
export function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (Array.from(flat).length <= max) return flat;
  const cut = Array.from(flat).slice(0, max - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?¿¡-]+$/u, "")}…`;
}
