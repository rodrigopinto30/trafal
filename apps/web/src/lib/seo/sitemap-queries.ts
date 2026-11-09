import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SitemapSources } from "./sitemap";

/** The most of each kind the sitemap lists (a sitemap file can hold 50 000 addresses, and every one is listed in each language). */
const LIMIT = 5000;

/** What the sitemap lists, read like any visitor would (only public data): published games, creators with a published game, and published updates. */
export async function listSitemapSources(): Promise<SitemapSources> {
  const supabase = await createClient();
  const [games, posts] = await Promise.all([
    supabase.from("games").select("public_id, updated_at, owner:profiles!games_owner_id_fkey(username, updated_at)").eq("status", "published").order("published_at", { ascending: false }).limit(LIMIT),
    supabase.from("posts").select("id, updated_at").eq("status", "published").order("created_at", { ascending: false }).limit(LIMIT),
  ]);
  const gameRows = games.data ?? [];
  const creators = new Map<string, string>();
  for (const game of gameRows) if (game.owner) creators.set(game.owner.username, game.owner.updated_at);
  return {
    games: gameRows.map(({ public_id, updated_at }) => ({ public_id, updated_at })),
    creators: [...creators].map(([username, updated_at]) => ({ username, updated_at })),
    posts: posts.data ?? [],
  };
}
