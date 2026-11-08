import { z } from "zod";
import { ENGINE_IDS, GENRE_IDS } from "@/lib/profile/catalog";
import { parseSearchQuery } from "./search";

export const EXPLORE_SORTS = ["recent", "trending", "plays", "relevance"] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];

export const EXPLORE_PAGE_SIZE = 24;
export const EXPLORE_MAX_PAGE = 400;

export type ExploreQuery = {
  q: string | null;
  genre: string | null;
  engine: string | null;
  mobile: boolean;
  sort: ExploreSort;
  page: number;
};

type RawExplore = { q?: string; genre?: string; engine?: string; mobile?: string; sort?: string; page?: string };

const page = z.coerce.number().int().min(1).max(EXPLORE_MAX_PAGE).catch(1);

/** The order a person gets without choosing one: the best match when they searched for something, the newest otherwise. */
export function defaultSort(q: string | null): ExploreSort {
  return q ? "relevance" : "recent";
}

/**
 * Everything on the explore page comes from the address bar, so everything is checked: the text is cleaned, a genre or an
 * engine that is not in the catalog is ignored, an unknown order is the default one (and «relevance» only makes sense with a
 * text), and the page is a whole number between 1 and the maximum.
 */
export function parseExploreQuery(raw: RawExplore): ExploreQuery {
  const q = parseSearchQuery(raw.q);
  const sort = EXPLORE_SORTS.find((candidate) => candidate === raw.sort);
  return {
    q,
    genre: GENRE_IDS.find((id) => id === raw.genre) ?? null,
    engine: ENGINE_IDS.find((id) => id === raw.engine) ?? null,
    mobile: raw.mobile === "1",
    sort: sort === undefined || (sort === "relevance" && !q) ? defaultSort(q) : sort,
    page: page.parse(raw.page),
  };
}

/** The address of a view, leaving out what is the default so that links stay short. `without` drops parameters (the search box keeps the filters but replaces the text and goes back to page 1). */
export function exploreHref(query: ExploreQuery, without: readonly ("q" | "page")[] = []): string {
  const params = new URLSearchParams();
  if (query.q && !without.includes("q")) params.set("q", query.q);
  if (query.genre) params.set("genre", query.genre);
  if (query.engine) params.set("engine", query.engine);
  if (query.mobile) params.set("mobile", "1");
  if (query.sort !== defaultSort(query.q)) params.set("sort", query.sort);
  if (query.page > 1 && !without.includes("page")) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `/explore?${text}` : "/explore";
}

/** Whether the person narrowed the list down with any filter (the text and the order are not filters). */
export function hasFilters(query: ExploreQuery): boolean {
  return query.genre !== null || query.engine !== null || query.mobile;
}
