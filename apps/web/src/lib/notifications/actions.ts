"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { notificationIdSchema } from "@/lib/validation/notifications";

export type NotificationResult = { ok: true } | { ok: false; error: "unauthenticated" | "generic" };

/** Marks one of the person's notifications as read. The database only lets them change their own, and only the read mark. */
export async function markNotificationReadAction(rawInput: unknown): Promise<NotificationResult> {
  if (!(await getAuthUser())) return { ok: false, error: "unauthenticated" };
  const parsed = notificationIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data.id).is("read_at", null);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marks every unread notification of the person as read. */
export async function markAllNotificationsReadAction(): Promise<NotificationResult> {
  if (!(await getAuthUser())) return { ok: false, error: "unauthenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
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
