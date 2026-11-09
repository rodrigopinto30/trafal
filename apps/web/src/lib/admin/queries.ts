import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ReportStatusFilter } from "@/lib/validation/admin";

export const ADMIN_PAGE_SIZE = 15;

export type AdminReport = {
  id: string;
  target_type: "game" | "post" | "comment" | "profile";
  target_id: string;
  reason: string;
  detail: string;
  snapshot: Record<string, unknown>;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter: { username: string; display_name: string } | null;
  resolver: { username: string } | null;
  target: { status: string | null; href: string | null } | null;
};

const STATUSES: Record<ReportStatusFilter, string[]> = { open: ["open"], reviewing: ["reviewing"], resolved: ["actioned", "dismissed"] };

/** Reports of a state, oldest first for the ones waiting (the longest wait goes first) and newest first for the resolved, with where each target stands now. */
export async function listReports(filter: ReportStatusFilter, before: string | null): Promise<{ reports: AdminReport[]; nextBefore: string | null }> {
  const supabase = await createClient();
  const resolved = filter === "resolved";
  let query = supabase
    .from("reports")
    .select("id, target_type, target_id, reason, detail, snapshot, status, resolution_note, resolved_at, created_at, reporter:profiles!reports_reporter_id_fkey(username, display_name), resolver:profiles!reports_resolved_by_fkey(username)")
    .in("status", STATUSES[filter])
    .order(resolved ? "resolved_at" : "created_at", { ascending: !resolved })
    .limit(ADMIN_PAGE_SIZE + 1);
  if (before) query = resolved ? query.lt("resolved_at", before) : query.gt("created_at", before);
  const { data } = await query;
  const rows = data ?? [];
  const page = rows.slice(0, ADMIN_PAGE_SIZE);
  const last = page.at(-1);
  const cursor = last ? (resolved ? last.resolved_at : last.created_at) : null;

  const idsOf = (type: string) => page.filter((row) => row.target_type === type).map((row) => row.target_id);
  const [games, posts, comments, profiles] = await Promise.all([
    idsOf("game").length ? supabase.from("games").select("id, status, public_id").in("id", idsOf("game")) : { data: [] },
    idsOf("post").length ? supabase.from("posts").select("id, status").in("id", idsOf("post")) : { data: [] },
    idsOf("comment").length ? supabase.from("comments").select("id, status, game:games!comments_game_id_fkey(public_id), post_id").in("id", idsOf("comment")) : { data: [] },
    idsOf("profile").length ? supabase.from("profiles").select("id, username").in("id", idsOf("profile")) : { data: [] },
  ]);
  const targets = new Map<string, { status: string | null; href: string | null }>();
  for (const game of games.data ?? []) targets.set(game.id, { status: game.status, href: game.status === "published" ? `/games/${game.public_id}` : null });
  for (const post of posts.data ?? []) targets.set(post.id, { status: post.status, href: post.status === "published" ? `/posts/${post.id}` : null });
  for (const comment of comments.data ?? []) {
    const href = comment.status !== "published" ? null : comment.game ? `/games/${comment.game.public_id}` : comment.post_id ? `/posts/${comment.post_id}` : null;
    targets.set(comment.id, { status: comment.status, href });
  }
  for (const profile of profiles.data ?? []) targets.set(profile.id, { status: null, href: `/u/${profile.username}` });

  return {
    reports: page.map((row) => ({ ...(row as unknown as AdminReport), target: targets.get(row.target_id) ?? null })),
    nextBefore: rows.length > ADMIN_PAGE_SIZE ? cursor : null,
  };
}

/** How many reports wait in each state (for the tabs). */
export async function countReports(): Promise<Record<ReportStatusFilter, number>> {
  const supabase = await createClient();
  const count = async (statuses: string[]) => (await supabase.from("reports").select("id", { count: "exact", head: true }).in("status", statuses)).count ?? 0;
  const [open, reviewing, resolved] = await Promise.all([count(STATUSES.open), count(STATUSES.reviewing), count(STATUSES.resolved)]);
  return { open, reviewing, resolved };
}

export type LogEntry = { id: number; admin_username: string; action: string; target_type: string; target_id: string | null; reason: string | null; created_at: string };

/** The moderation log, newest first, one page at a time (`before` is the date of the last entry seen). */
export async function listModerationLog(before: string | null): Promise<{ entries: LogEntry[]; nextBefore: string | null }> {
  const supabase = await createClient();
  let query = supabase.from("moderation_log").select("id, admin_username, action, target_type, target_id, reason, created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(ADMIN_PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);
  const { data } = await query;
  const rows = data ?? [];
  const entries = rows.slice(0, ADMIN_PAGE_SIZE);
  return { entries, nextBefore: rows.length > ADMIN_PAGE_SIZE ? (entries.at(-1)?.created_at ?? null) : null };
}

export type FeaturedPick = { week_start: string; quote: string | null; game: { public_id: string; title: string } | null };

/** The picks for the current week and the coming ones, and the latest earlier one (what the landing page shows when this week has none). */
export async function listFeaturedPicks(thisWeek: string): Promise<{ upcoming: FeaturedPick[]; previous: FeaturedPick | null }> {
  const supabase = await createClient();
  const select = "week_start, quote, game:games!featured_games_game_id_fkey(public_id, title)";
  const [upcoming, previous] = await Promise.all([
    supabase.from("featured_games").select(select).gte("week_start", thisWeek).order("week_start"),
    supabase.from("featured_games").select(select).lt("week_start", thisWeek).order("week_start", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return { upcoming: upcoming.data ?? [], previous: previous.data };
}

export type EligibleGame = { id: string; title: string; owner: string };

/** Published games that are their creator's first game and have never been the first game of a week. */
export async function listEligibleFirstGames(): Promise<EligibleGame[]> {
  const supabase = await createClient();
  const [games, used] = await Promise.all([
    supabase.from("games").select("id, title, owner:profiles!games_owner_id_fkey(display_name)").eq("status", "published").eq("is_first_game", true).order("published_at", { ascending: false }).limit(200),
    supabase.from("featured_games").select("game_id"),
  ]);
  const featured = new Set((used.data ?? []).map((row) => row.game_id));
  return (games.data ?? []).filter((game) => !featured.has(game.id)).map((game) => ({ id: game.id, title: game.title, owner: game.owner?.display_name ?? "" }));
}
