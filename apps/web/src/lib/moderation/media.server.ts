import "server-only";
import { moveMediaObject } from "@/lib/storage/s3.server";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Content that has files of its own on the media domain: a game (its cover and GIF) or an update (its images and videos). */
export type ModeratedTarget = { type: "game" | "post"; id: string };

const HIDDEN_STATUSES = new Set(["hidden", "removed"]);

async function filesOf(supabase: Supabase, target: ModeratedTarget): Promise<{ hidden: boolean; keys: string[] } | null> {
  if (target.type === "game") {
    const { data } = await supabase.from("games").select("status, cover_path, gif_path").eq("id", target.id).maybeSingle();
    if (!data) return null;
    return { hidden: HIDDEN_STATUSES.has(data.status), keys: [data.cover_path, data.gif_path].filter((key): key is string => !!key) };
  }
  const [{ data: post }, { data: media }] = await Promise.all([
    supabase.from("posts").select("status").eq("id", target.id).maybeSingle(),
    supabase.from("post_media").select("path").eq("post_id", target.id),
  ]);
  if (!post) return null;
  return { hidden: HIDDEN_STATUSES.has(post.status), keys: (media ?? []).map((item) => item.path) };
}

/**
 * After a moderation decision, puts the files of each target where its new state says: what moderation hid moves to the private
 * bucket, so its public address stops working; what it restored comes back. It runs as the admin (who can read hidden content) and
 * never fails the decision, which is already saved: a file it could not move is logged to fix by hand.
 */
export async function placeModeratedMedia(supabase: Supabase, targets: readonly ModeratedTarget[]): Promise<void> {
  for (const target of targets) {
    const files = await filesOf(supabase, target);
    if (!files) continue;
    for (const key of files.keys) {
      try {
        await moveMediaObject(key, files.hidden ? "hidden" : "public");
      } catch (error) {
        console.error(`[moderation] could not move ${key} to the ${files.hidden ? "hidden" : "public"} bucket`, error);
      }
    }
  }
}
