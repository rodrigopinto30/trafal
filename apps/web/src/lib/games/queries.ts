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
