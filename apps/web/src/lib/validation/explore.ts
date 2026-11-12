import { GENRE_IDS } from "@/lib/profile/catalog";
import { parseSearchQuery } from "./search";

export const EXPLORE_SORTS = ["recent", "trending", "plays", "relevance"] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];

/** The parameters of the address that make the home a search view (they are what the proxy looks for to serve it to visitors too). */
export const EXPLORE_PARAMS = ["q", "genre", "sort", "page"] as const;

export const EXPLORE_PAGE_SIZE = 24;
export const EXPLORE_MAX_PAGE = 400;

export type ExploreQuery = {
  q: string | null;
  genre: string | null;
  sort: ExploreSort;
  page: number;
};

type RawExplore = { q?: string; genre?: string; sort?: string; page?: string };

function parsePage(value: string | undefined): number {
  const page = value !== undefined && /^[0-9]{1,6}$/.test(value) ? Number(value) : 1;
  return page >= 1 && page <= EXPLORE_MAX_PAGE ? page : 1;
}

/** The order a person gets without choosing one: the best match when they searched for something, the newest otherwise. */
export function defaultSort(q: string | null): ExploreSort {
  return q ? "relevance" : "recent";
}

/**
 * Everything on the search view of the home comes from the address bar, so everything is checked: the text is cleaned, a genre that
 * is not in the catalog is ignored, an unknown order is the default one (and «relevance» only makes sense with a
 * text), and the page is a whole number between 1 and the maximum.
 */
export function parseExploreQuery(raw: RawExplore): ExploreQuery {
  const q = parseSearchQuery(raw.q);
  const sort = EXPLORE_SORTS.find((candidate) => candidate === raw.sort);
  return {
    q,
    genre: GENRE_IDS.find((id) => id === raw.genre) ?? null,
    sort: sort === undefined || (sort === "relevance" && !q) ? defaultSort(q) : sort,
    page: parsePage(raw.page),
  };
}

/** The address of a view, leaving out what is the default so that links stay short. `without` drops parameters (the search box keeps the filters but replaces the text and goes back to page 1). */
export function exploreHref(query: ExploreQuery, without: readonly ("q" | "page")[] = []): string {
  const params = new URLSearchParams();
  if (query.q && !without.includes("q")) params.set("q", query.q);
  if (query.genre) params.set("genre", query.genre);
  if (query.sort !== defaultSort(query.q)) params.set("sort", query.sort);
  if (query.page > 1 && !without.includes("page")) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `/?${text}` : "/";
}

/** Whether the person narrowed the list down with any filter (the text and the order are not filters). */
export function hasFilters(query: ExploreQuery): boolean {
  return query.genre !== null;
}

/** Whether the address asks for a search or a filtered, sorted or later page of the games (anything else is the plain home). */
export function isExploring(query: ExploreQuery): boolean {
  return query.q !== null || hasFilters(query) || query.sort !== defaultSort(query.q) || query.page > 1;
}
