import { z } from "zod";

export const FEED_KINDS = ["all", "avance", "nuevo_juego", "pide_feedback", "hito"] as const;
export const FEED_SCOPES = ["all", "following"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];
export type FeedScope = (typeof FEED_SCOPES)[number];

export const FEED_PAGE_SIZE = 12;

const kind = z.enum(FEED_KINDS).catch("all");
const scope = z.enum(FEED_SCOPES).catch("all");
const before = z.iso.datetime({ offset: true }).nullable().catch(null);

export type FeedQuery = { kind: FeedKind; scope: FeedScope; before: string | null };

/** The filters of the feed come from the address bar: anything that is not one of the known values falls back to the default. */
export function parseFeedQuery(raw: { kind?: string; scope?: string; before?: string }): FeedQuery {
  return { kind: kind.parse(raw.kind), scope: scope.parse(raw.scope), before: before.parse(raw.before ?? null) };
}

/** The address of a feed view, leaving out what is the default so shared links stay short. */
export function feedHref(query: FeedQuery): string {
  const params = new URLSearchParams();
  if (query.kind !== "all") params.set("kind", query.kind);
  if (query.scope !== "all") params.set("scope", query.scope);
  if (query.before) params.set("before", query.before);
  const text = params.toString();
  return text ? `/feed?${text}` : "/feed";
}
