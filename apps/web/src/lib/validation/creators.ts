import { GENRE_IDS } from "@/lib/profile/catalog";
import { parseSearchQuery } from "./search";

export const CREATORS_SORTS = ["newest", "followers", "games"] as const;
export type CreatorsSort = (typeof CREATORS_SORTS)[number];

export const CREATORS_PAGE_SIZE = 12;
export const CREATORS_MAX_PAGE = 400;

export type CreatorsQuery = {
  q: string | null;
  genre: string | null;
  sort: CreatorsSort;
  page: number;
};

type RawCreators = { q?: string; genre?: string; sort?: string; page?: string };

function parsePage(value: string | undefined): number {
  const page = value !== undefined && /^[0-9]{1,6}$/.test(value) ? Number(value) : 1;
  return page >= 1 && page <= CREATORS_MAX_PAGE ? page : 1;
}

/** The order a person gets without choosing one: the newest members first, because Trafal is for people who are just starting out. */
export const DEFAULT_CREATORS_SORT: CreatorsSort = "newest";

/** Everything on the creators page comes from the address bar, so everything is checked (see parseExploreQuery for the same rules). */
export function parseCreatorsQuery(raw: RawCreators): CreatorsQuery {
  return {
    q: parseSearchQuery(raw.q),
    genre: GENRE_IDS.find((id) => id === raw.genre) ?? null,
    sort: CREATORS_SORTS.find((candidate) => candidate === raw.sort) ?? DEFAULT_CREATORS_SORT,
    page: parsePage(raw.page),
  };
}

/** The address of a view, leaving out what is the default so that links stay short. */
export function creatorsHref(query: CreatorsQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.genre) params.set("genre", query.genre);
  if (query.sort !== DEFAULT_CREATORS_SORT) params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `/creators?${text}` : "/creators";
}

/** Whether the person narrowed the list with a filter (the text and the order are not filters). */
export function hasCreatorFilters(query: CreatorsQuery): boolean {
  return query.genre !== null;
}
