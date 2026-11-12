import "server-only";
import { createClient } from "@/lib/supabase/server";

export const NOTIFICATIONS_PAGE_SIZE = 20;

export type NotificationData = { action?: string; target_type?: string; reason?: string; until?: string | null; error_code?: string; note?: string; kind?: string };

export type NotificationItem = {
  id: string;
  type: "comment" | "reply" | "like" | "follow" | "helpful" | "version_ready" | "version_error" | "moderation";
  read_at: string | null;
  created_at: string;
  data: NotificationData;
  actor: { username: string; display_name: string } | null;
  game: { public_id: string; title: string } | null;
  post: { id: string; body: string } | null;
  comment: { id: string; body: string; post_id: string | null; game: { public_id: string } | null } | null;
  version: { label: string } | null;
};

const SELECT =
  "id, type, read_at, created_at, data, actor:profiles!notifications_actor_id_fkey(username, display_name), game:games!notifications_game_id_fkey(public_id, title), post:posts!notifications_post_id_fkey(id, body), comment:comments!notifications_comment_id_fkey(id, body, post_id, game:games!comments_game_id_fkey(public_id)), version:game_versions!notifications_version_id_fkey(label)";

/**
 * How many notifications the signed-in person has neither seen nor read (the number on the bell). Opening the bell's menu sees them,
 * so the number goes away, but they stay unread in the notifications screen until they are opened. Zero without a session: the
 * database only shows their own.
 */
export async function countUnseenNotifications(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("seen_at", null).is("read_at", null);
  return count ?? 0;
}

/** The signed-in person's notifications, newest first, one page at a time (`before` is the date of the last one seen). */
export async function listNotifications(before: string | null): Promise<{ items: NotificationItem[]; nextBefore: string | null }> {
  const supabase = await createClient();
  let query = supabase.from("notifications").select(SELECT).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(NOTIFICATIONS_PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);
  const { data } = await query;
  const rows = (data ?? []) as unknown as NotificationItem[];
  const items = rows.slice(0, NOTIFICATIONS_PAGE_SIZE);
  return { items, nextBefore: rows.length > NOTIFICATIONS_PAGE_SIZE ? (items.at(-1)?.created_at ?? null) : null };
}

/** The latest notifications of the signed-in person (the ones the bell shows), newest first. */
export async function listRecentNotifications(limit: number): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select(SELECT).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as NotificationItem[];
}

/** One of the signed-in person's notifications, with what it needs to know where it leads. */
export async function findNotification(id: string): Promise<NotificationItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select(SELECT).eq("id", id).maybeSingle();
  return (data as unknown as NotificationItem | null) ?? null;
}
