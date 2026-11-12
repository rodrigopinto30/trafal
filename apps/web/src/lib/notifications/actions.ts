"use server";

import { revalidatePath } from "next/cache";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { formatRelativeTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { notificationBatchSchema, notificationIdSchema, notificationReadBatchSchema } from "@/lib/validation/notifications";
import { parseLocale } from "@/lib/validation/common";
import { NOTIFICATIONS_MENU_SIZE } from "./menu";
import { readMarkNow } from "./read-mark";
import { listRecentNotifications } from "./queries";
import { notificationDetail, notificationSentence } from "./text";

export type NotificationResult = { ok: true } | { ok: false; error: "unauthenticated" | "generic" };

/** One line of the bell's menu, already in the person's language. `href` opens it (marking it as read) through the route handler. */
export type BellEntry = { id: string; text: string; detail: string | null; when: string; unread: boolean; href: string };
export type RecentNotificationsResult = { ok: true; entries: BellEntry[] } | { ok: false };

/** The latest notifications for the bell's menu. The database only shows the person their own. */
export async function recentNotificationsAction(rawLocale: unknown): Promise<RecentNotificationsResult> {
  const locale = parseLocale(rawLocale);
  if (!(await getAuthUser())) return { ok: false };
  const items = await listRecentNotifications(NOTIFICATIONS_MENU_SIZE);
  const t = getTranslationsFor(locale, "notifications");
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" });
  const now = new Date();
  return {
    ok: true,
    entries: items.map((item) => ({
      id: item.id,
      text: notificationSentence(item, t),
      detail: notificationDetail(item, t, (date) => day.format(date)),
      when: formatRelativeTime(locale, item.created_at, now),
      unread: item.read_at === null,
      href: `/api/notifications/${item.id}?lang=${locale}`,
    })),
  };
}

/** Marks every notification the person has not seen yet as seen: what happens when they open the bell's menu. They stay unread. */
export async function markNotificationsSeenAction(): Promise<NotificationResult> {
  if (!(await getAuthUser())) return { ok: false, error: "unauthenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ seen_at: new Date().toISOString() }).is("seen_at", null);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marks one of the person's notifications as read. The database only lets them change their own, and only the read mark. */
export async function markNotificationReadAction(rawInput: unknown): Promise<NotificationResult> {
  if (!(await getAuthUser())) return { ok: false, error: "unauthenticated" };
  const parsed = notificationIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update(readMarkNow()).eq("id", parsed.data.id).is("read_at", null);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marks every unread notification of the person as read. */
export async function markAllNotificationsReadAction(): Promise<NotificationResult> {
  if (!(await getAuthUser())) return { ok: false, error: "unauthenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update(readMarkNow()).is("read_at", null);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Dismisses (deletes) one of the person's notifications. */
export async function deleteNotificationAction(rawInput: unknown): Promise<NotificationResult> {
  if (!(await getAuthUser())) return { ok: false, error: "unauthenticated" };
  const parsed = notificationIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marks several of the person's notifications as read, or as unread again (what the selection of the notifications screen does). */
export async function setNotificationsReadAction(rawInput: unknown): Promise<NotificationResult> {
  if (!(await getAuthUser())) return { ok: false, error: "unauthenticated" };
  const parsed = notificationReadBatchSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const query = supabase.from("notifications").update(parsed.data.read ? readMarkNow() : { read_at: null }).in("id", parsed.data.ids);
  const { error } = await (parsed.data.read ? query.is("read_at", null) : query.not("read_at", "is", null));
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Dismisses (deletes) several of the person's notifications at once. */
export async function deleteNotificationsAction(rawInput: unknown): Promise<NotificationResult> {
  if (!(await getAuthUser())) return { ok: false, error: "unauthenticated" };
  const parsed = notificationBatchSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().in("id", parsed.data.ids);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}
