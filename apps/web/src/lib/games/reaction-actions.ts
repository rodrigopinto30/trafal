"use server";

import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isUsageLimitError } from "@/lib/usage/limit";
import { reactionSchema, type ReactionInput } from "@/lib/validation/reaction";

export type ReactionResult = { ok: true; active: boolean; count: number } | { ok: false; reason: "unauthenticated" | "restricted" | "rateLimited" | "generic" };

type Failure = Extract<ReactionResult, { ok: false }>;
type Database = Awaited<ReturnType<typeof createClient>>;

async function readCount(supabase: Database, { target, kind, id }: ReactionInput): Promise<number> {
  const column = kind === "like" ? "like_count" : "save_count";
  const { data } = target === "game"
    ? await supabase.from("games").select(column).eq("id", id).maybeSingle()
    : await supabase.from("posts").select(column).eq("id", id).maybeSingle();
  return (data as Record<string, number> | null)?.[column] ?? 0;
}

async function setMark(supabase: Database, userId: string, input: ReactionInput): Promise<{ code?: string; message?: string } | null> {
  const { target, kind, id, active } = input;
  const key = `${target}_${kind}` as const;
  if (active) {
    const { error } =
      key === "game_like" ? await supabase.from("game_likes").insert({ user_id: userId, game_id: id })
      : key === "game_save" ? await supabase.from("game_saves").insert({ user_id: userId, game_id: id })
      : key === "post_like" ? await supabase.from("post_likes").insert({ user_id: userId, post_id: id })
      : await supabase.from("post_saves").insert({ user_id: userId, post_id: id });
    return error && error.code !== "23505" ? error : null;
  }
  const { error } =
    key === "game_like" ? await supabase.from("game_likes").delete().eq("user_id", userId).eq("game_id", id)
    : key === "game_save" ? await supabase.from("game_saves").delete().eq("user_id", userId).eq("game_id", id)
    : key === "post_like" ? await supabase.from("post_likes").delete().eq("user_id", userId).eq("post_id", id)
    : await supabase.from("post_saves").delete().eq("user_id", userId).eq("post_id", id);
  return error;
}

/**
 * Puts a like or a save on a game or a post, or takes it off. It is idempotent: asking for the state the person is already in
 * changes nothing. The database decides who can do what (own marks only, visible content only, active accounts only) and keeps
 * the counters; the new public count comes back so the page shows the real number.
 */
export async function setReactionAction(rawInput: unknown): Promise<ReactionResult> {
  const fail = (reason: Failure["reason"]): Failure => ({ ok: false, reason });

  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const parsed = reactionSchema.safeParse(rawInput);
  if (!parsed.success) return fail("generic");

  const supabase = await createClient();
  const error = await setMark(supabase, user.id, parsed.data);
  if (error) {
    if (isUsageLimitError(error)) return fail("rateLimited");
    if (error.code === "42501") return fail("restricted");
    console.error("[reaction] could not change the mark", error);
    return fail("generic");
  }
  return { ok: true, active: parsed.data.active, count: await readCount(supabase, parsed.data) };
}
