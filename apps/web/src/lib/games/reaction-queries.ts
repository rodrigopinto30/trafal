import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ReactionTarget } from "@/lib/validation/reaction";
import type { GameSummary, PostSummary } from "./types";
import { listGamesByIds, listPostsByIds } from "./queries";

export type MyReactions = { liked: ReadonlySet<string>; saved: ReadonlySet<string> };

const NONE: MyReactions = { liked: new Set(), saved: new Set() };

/** Which of these games or posts the signed-in person has liked and saved (the database only lets them see their own marks). */
export async function listMyReactions(target: ReactionTarget, ids: string[]): Promise<MyReactions> {
  if (ids.length === 0) return NONE;
  const supabase = await createClient();
  const [likes, saves] =
    target === "game"
      ? await Promise.all([
          supabase.from("game_likes").select("game_id").in("game_id", ids),
          supabase.from("game_saves").select("game_id").in("game_id", ids),
        ])
      : await Promise.all([
          supabase.from("post_likes").select("post_id").in("post_id", ids),
          supabase.from("post_saves").select("post_id").in("post_id", ids),
        ]);
  const collect = (rows: Record<string, string>[] | null, column: string) => new Set((rows ?? []).map((row) => row[column] as string));
  const column = `${target}_id`;
  return { liked: collect(likes.data, column), saved: collect(saves.data, column) };
}

const SAVED_LIMIT = 100;

/** Published games the person saved, most recently saved first. */
export async function listSavedGames(userId: string): Promise<GameSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("game_saves").select("game_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(SAVED_LIMIT);
  return listGamesByIds((data ?? []).map((row) => row.game_id));
}

/** Published posts the person saved, most recently saved first. */
export async function listSavedPosts(userId: string): Promise<PostSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("post_saves").select("post_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(SAVED_LIMIT);
  return listPostsByIds((data ?? []).map((row) => row.post_id));
}
