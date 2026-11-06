import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  CommentSummary,
  CommunityHighlight,
  Creator,
  FeaturedGame,
  GameDetail,
  GameReference,
  GameSummary,
  PostKind,
  PostSummary,
} from "./types";

const GAME_COLUMNS =
  "id, public_id, title, short_description, genre_id, engine_id, tags, cover_path, works_on_mobile, is_first_game, display_ratio, play_count, like_count, comment_count, published_at, owner:profiles!games_owner_id_fkey(username, display_name, avatar_path)" as const;

const GAME_DETAIL_COLUMNS =
  "id, public_id, title, short_description, genre_id, engine_id, tags, cover_path, works_on_mobile, is_first_game, display_ratio, play_count, like_count, comment_count, published_at, controls, save_count, owner:profiles!games_owner_id_fkey(username, display_name, avatar_path)" as const;

const POST_COLUMNS =
  "id, kind, body, highlight, created_at, like_count, comment_count, author:profiles!posts_author_id_fkey(username, display_name, avatar_path), game:games!posts_game_id_fkey(public_id, title)" as const;

const COMMENT_COLUMNS =
  "id, parent_id, body, label, is_helpful, created_at, author:profiles!comments_author_id_fkey(username, display_name, avatar_path)" as const;

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
  author: Creator;
  game: GameReference | null;
}): PostSummary {
  return { ...row, kind: row.kind as PostKind };
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

export async function findFeaturedGame(): Promise<FeaturedGame | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("featured_games")
    .select(FEATURED_COLUMNS)
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
    .select("id, number, label, status, error_code, error_params, declared_size_bytes, created_at")
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
