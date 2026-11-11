import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CreatorsQuery } from "@/lib/validation/creators";
import { weekStartOf } from "./featured";
import type { ExploreQuery } from "@/lib/validation/explore";
import type {
  CommentSummary,
  CommunityHighlight,
  Creator,
  FeaturedGame,
  GameDetail,
  GameReference,
  GameSummary,
  PostKind,
  PostMediaKind,
  PostSummary,
  QuestionSummary,
} from "./types";

const GAME_COLUMNS =
  "id, public_id, title, short_description, genre_id, engine_id, tags, cover_path, works_on_mobile, is_first_game, display_ratio, play_count, like_count, comment_count, published_at, owner:profiles!games_owner_id_fkey(username, display_name, avatar_path)" as const;

const GAME_DETAIL_COLUMNS =
  "id, public_id, title, short_description, genre_id, engine_id, tags, cover_path, works_on_mobile, is_first_game, display_ratio, play_count, like_count, comment_count, published_at, controls, save_count, active_version_id, owner_id, owner:profiles!games_owner_id_fkey(username, display_name, avatar_path)" as const;

const POST_COLUMNS =
  "id, kind, body, highlight, created_at, like_count, comment_count, author_id, author:profiles!posts_author_id_fkey(username, display_name, avatar_path), game:games!posts_game_id_fkey(public_id, title), media:post_media(id, kind, path, mime, width, height, alt_text, position)" as const;

const COMMENT_COLUMNS =
  "id, question_id, author_id, updated_at, parent_id, body, label, is_helpful, created_at, author:profiles!comments_author_id_fkey(username, display_name, avatar_path)" as const;

const FEATURED_COLUMNS =
  "quote, game:games!featured_games_game_id_fkey(id, public_id, title, short_description, genre_id, engine_id, tags, cover_path, works_on_mobile, is_first_game, display_ratio, play_count, like_count, comment_count, published_at, status, owner:profiles!games_owner_id_fkey(username, display_name, avatar_path))" as const;

const PUBLISHED_GAMES_LIMIT = 200;

function hasOwner<T extends { owner: Creator | null }>(row: T): row is T & { owner: Creator } {
  return row.owner !== null;
}

function hasAuthor<T extends { author: Creator | null }>(row: T): row is T & { author: Creator } {
  return row.author !== null;
}

function toPost(row: {
  id: string;
  kind: string;
  body: string;
  highlight: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  author_id: string;
  author: Creator;
  game: GameReference | null;
  media: { id: string; kind: string; path: string; mime: string; width: number | null; height: number | null; alt_text: string; position: number }[];
}): PostSummary {
  const media = [...row.media].sort((a, b) => a.position - b.position).map((item) => ({ ...item, kind: item.kind as PostMediaKind }));
  return { ...row, kind: row.kind as PostKind, media };
}

export async function listPublishedGames(): Promise<GameSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(PUBLISHED_GAMES_LIMIT);
  return (data ?? []).filter(hasOwner);
}

/** Juegos publicados que coinciden con el texto, del más al menos relevante (el orden lo decide la función SQL search_games). */
export async function searchGames(query: string, limit: number): Promise<GameSummary[]> {
  const supabase = await createClient();
  const { data: ranked } = await supabase.rpc("search_games", { p_query: query, p_limit: limit });
  if (!ranked?.length) return [];
  const { data } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .in(
      "id",
      ranked.map((row) => row.id),
    )
    .eq("status", "published");
  const byId = new Map((data ?? []).filter(hasOwner).map((game) => [game.id, game]));
  return ranked.flatMap((row) => byId.get(row.id) ?? []);
}

export async function listGamesByOwner(ownerId: string): Promise<GameSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return (data ?? []).filter(hasOwner);
}

export const findGameByPublicId = cache(async (publicId: string): Promise<GameDetail | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(GAME_DETAIL_COLUMNS)
    .eq("public_id", publicId)
    .eq("status", "published")
    .maybeSingle();
  return data && hasOwner(data) ? data : null;
});

/** The first game of the week: this week's pick or, if this week has none yet, the latest one before it. A pick chosen ahead for a coming week stays hidden until its week starts. */
export async function findFeaturedGame(): Promise<FeaturedGame | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("featured_games")
    .select(FEATURED_COLUMNS)
    .lte("week_start", weekStartOf(new Date()))
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const game = data?.game;
  if (!data || !game || game.status !== "published" || !hasOwner(game)) return null;
  return { quote: data.quote, game };
}

export async function listLatestPosts(limit: number): Promise<PostSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("status", "published")
    .neq("kind", "nuevo_juego")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).filter(hasAuthor).map(toPost);
}

/** Published games by id, in the order of the ids (the order a list was built in). Hidden or removed ones are left out. */
export async function listGamesByIds(ids: string[]): Promise<GameSummary[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("games").select(GAME_COLUMNS).eq("status", "published").in("id", ids);
  const byId = new Map((data ?? []).filter(hasOwner).map((game) => [game.id, game]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Published posts by id, in the order of the ids. Hidden or removed ones are left out. */
export async function listPostsByIds(ids: string[]): Promise<PostSummary[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_COLUMNS).eq("status", "published").in("id", ids);
  const byId = new Map((data ?? []).filter(hasAuthor).map(toPost).map((post) => [post.id, post]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function listPostsByGame(gameId: string): Promise<PostSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("game_id", gameId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return (data ?? []).filter(hasAuthor).map(toPost);
}

export async function listPostsByAuthor(authorId: string, limit = 50): Promise<PostSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("author_id", authorId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).filter(hasAuthor).map(toPost);
}

export async function listCommentsByGame(gameId: string): Promise<CommentSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq("game_id", gameId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return (data ?? []).filter(hasAuthor).map((row) => ({ ...row, label: row.label as CommentSummary["label"] }));
}

export type FeedPage = { posts: PostSummary[]; nextBefore: string | null };

/**
 * One page of the feed: published updates, newest first, optionally of one kind and optionally only from the people the given
 * person follows. `before` is the date of the last update already seen, so each page starts where the previous one ended.
 */
export async function listFeed({ kind, followerId, before, limit }: { kind: string; followerId: string | null; before: string | null; limit: number }): Promise<FeedPage> {
  const supabase = await createClient();
  let authorIds: string[] | null = null;
  if (followerId) {
    const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", followerId);
    authorIds = (data ?? []).map((row) => row.followee_id);
    if (authorIds.length === 0) return { posts: [], nextBefore: null };
  }

  let query = supabase.from("posts").select(POST_COLUMNS).eq("status", "published").order("created_at", { ascending: false }).limit(limit + 1);
  if (kind !== "all") query = query.eq("kind", kind);
  if (before) query = query.lt("created_at", before);
  if (authorIds) query = query.in("author_id", authorIds);

  const { data } = await query;
  const rows = (data ?? []).filter(hasAuthor).map(toPost);
  const posts = rows.slice(0, limit);
  const last = posts.at(-1);
  return { posts, nextBefore: rows.length > limit && last ? last.created_at : null };
}

export type ExplorePage = { games: GameSummary[]; total: number };

/** One page of the explore list: the database filters, orders and counts; the games come back by id in that same order. */
export async function exploreGames(query: ExploreQuery, limit: number): Promise<ExplorePage> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("explore_games", {
    p_query: query.q ?? undefined,
    p_genre: query.genre ?? undefined,
    p_engine: query.engine ?? undefined,
    p_mobile_only: query.mobile,
    p_sort: query.sort,
    p_limit: limit,
    p_offset: (query.page - 1) * limit,
  });
  const rows = data ?? [];
  return { games: await listGamesByIds(rows.map((row) => row.id)), total: Number(rows[0]?.total ?? 0) };
}

export type ProfileSeo = { username: string; display_name: string; bio: string; city: string | null; country: string | null; created_at: string };

/** What the search engines and the social cards need to know about a profile (shared by the page and its metadata within one request). */
export const findProfileSeo = cache(async (username: string): Promise<ProfileSeo | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("username, display_name, bio, city, country, created_at").eq("username", username).maybeSingle();
  return data;
});

export type CreatorCard = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio: string;
  city: string | null;
  country: string | null;
  engines: string[];
  favorite_genres: string[];
  followers_count: number;
  games_count: number;
};

export type CreatorsPage = { creators: CreatorCard[]; total: number };

/** One page of the creators directory: the database filters, orders and counts; the profiles come back by id in that same order. */
export async function exploreCreators(query: CreatorsQuery, limit: number): Promise<CreatorsPage> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("explore_creators", {
    p_query: query.q ?? undefined,
    p_engine: query.engine ?? undefined,
    p_genre: query.genre ?? undefined,
    p_sort: query.sort,
    p_limit: limit,
    p_offset: (query.page - 1) * limit,
  });
  const rows = data ?? [];
  if (rows.length === 0) return { creators: [], total: 0 };

  const ids = rows.map((row) => row.id);
  const [profiles, games] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_path, bio, city, country, engines, favorite_genres, followers_count").in("id", ids),
    supabase.from("games").select("owner_id").eq("status", "published").in("owner_id", ids),
  ]);
  const gamesBy = new Map<string, number>();
  for (const game of games.data ?? []) gamesBy.set(game.owner_id, (gamesBy.get(game.owner_id) ?? 0) + 1);
  const byId = new Map((profiles.data ?? []).map((profile) => [profile.id, { ...profile, games_count: gamesBy.get(profile.id) ?? 0 }]));
  return { creators: ids.flatMap((id) => byId.get(id) ?? []), total: Number(rows[0]?.total ?? 0) };
}

/** Which of these people the signed-in person follows (the database only shows them their own follows). */
export async function listFollowedAmong(followerId: string, ids: string[]): Promise<ReadonlySet<string>> {
  if (ids.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", followerId).in("followee_id", ids);
  return new Set((data ?? []).map((row) => row.followee_id));
}

/** The questions the creator of a game asks the people who play it, in the order they were written. */
export async function listQuestionsByGame(gameId: string): Promise<QuestionSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("game_questions").select("id, position, question").eq("game_id", gameId).order("position");
  return data ?? [];
}

/** Published comments on an update, newest first (replies are grouped under their comment by `groupComments`). */
export async function listCommentsByPost(postId: string): Promise<CommentSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return (data ?? []).filter(hasAuthor).map((row) => ({ ...row, label: row.label as CommentSummary["label"] }));
}

/** A published update by id, for its own page. */
export async function findPostById(postId: string): Promise<PostSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_COLUMNS).eq("id", postId).eq("status", "published").maybeSingle();
  return data && hasAuthor(data) ? toPost(data) : null;
}

export async function listCommunityHighlights(limit: number): Promise<CommunityHighlight[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select(`${COMMENT_COLUMNS}, game:games!comments_game_id_fkey(public_id, title)`)
    .eq("label", "liked")
    .eq("status", "published")
    .not("game_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).flatMap((row) =>
    row.author && row.game ? [{ ...row, author: row.author, game: row.game, label: row.label as CommentSummary["label"] }] : [],
  );
}

export type OwnGame = {
  id: string;
  public_id: string;
  title: string;
  status: string;
  works_on_mobile: boolean;
  active_version_id: string | null;
};

export type OwnGameVersion = {
  id: string;
  number: number;
  label: string;
  status: string;
  error_code: string | null;
  error_params: unknown;
  changelog: string;
  declared_size_bytes: number | null;
  created_at: string;
};

/** A game of the signed-in person, whatever its status (drafts included). RLS plus the owner filter keep it to their own. */
export async function findOwnGame(publicId: string, ownerId: string): Promise<OwnGame | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("id, public_id, title, status, works_on_mobile, active_version_id")
    .eq("public_id", publicId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data;
}

export async function listVersionsOfGame(gameId: string): Promise<OwnGameVersion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_versions")
    .select("id, number, label, status, error_code, error_params, changelog, declared_size_bytes, created_at")
    .eq("game_id", gameId)
    .order("number", { ascending: false });
  return data ?? [];
}

/** The signed-in person's games that are not published yet (drafts, or hidden/removed by moderation). */
export async function listOwnUnpublishedGames(ownerId: string): Promise<OwnGame[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("id, public_id, title, status, works_on_mobile, active_version_id")
    .eq("owner_id", ownerId)
    .neq("status", "published")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type GameDelivery = { needsIsolation: boolean };

/** What the player needs to know about a published game's active version, or null if it cannot be played. */
export async function findGameDelivery(publicId: string): Promise<GameDelivery | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("game_delivery", { p_public_id: publicId });
  const row = data?.[0];
  return row && row.state === "published" ? { needsIsolation: row.needs_isolation } : null;
}

export type PublicVersion = { id: string; number: number; label: string; changelog: string; processed_at: string | null };

/** The ready versions of a published game, newest first: what its «Versions» section shows (anyone can read them). */
export async function listReadyVersions(gameId: string): Promise<PublicVersion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_versions")
    .select("id, number, label, changelog, processed_at")
    .eq("game_id", gameId)
    .eq("status", "ready")
    .order("number", { ascending: false });
  return data ?? [];
}

export type EditablePost = {
  id: string;
  updated_at: string;
  kind: PostKind;
  body: string;
  highlight: string | null;
  game: { id: string; title: string } | null;
  media: { id: string; kind: PostMediaKind; path: string; alt_text: string }[];
};

/** An update the person wrote and may edit (a moderated one cannot be edited), with its game and files in order. */
export async function findOwnPostForEdit(postId: string, authorId: string): Promise<EditablePost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, updated_at, kind, body, highlight, game:games!posts_game_id_fkey(id, title), media:post_media(id, kind, path, alt_text, position)")
    .eq("id", postId)
    .eq("author_id", authorId)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  const media = [...data.media].sort((a, b) => a.position - b.position).map(({ id, kind, path, alt_text }) => ({ id, kind: kind as PostMediaKind, path, alt_text }));
  return { id: data.id, updated_at: data.updated_at, kind: data.kind as PostKind, body: data.body, highlight: data.highlight, game: data.game, media };
}
