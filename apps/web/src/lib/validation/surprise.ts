import { parseLocale, parsePublicIdParam } from "./common";

/** What the «Sorprendeme» address carries: the language to answer in and the game being looked at (to leave it out). Anything that does not look right is ignored. */
export function parseSurpriseParams(raw: { lang?: string | null; exclude?: string | null }) {
  return { locale: parseLocale(raw.lang), exclude: raw.exclude ? parsePublicIdParam(raw.exclude) : null };
}

/** The address of the button: a plain link, so it works without JavaScript and is never prefetched (each visit picks a new game). */
export function surpriseHref(locale: string, exclude?: string): string {
  const params = new URLSearchParams({ lang: locale });
  if (exclude) params.set("exclude", exclude);
  return `/api/surprise?${params.toString()}`;
}
