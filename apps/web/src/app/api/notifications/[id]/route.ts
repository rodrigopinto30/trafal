import { NextResponse, type NextRequest } from "next/server";
import { localizePath } from "@/i18n/path";
import { publicEnv } from "@/lib/env";
import { notificationHref } from "@/lib/notifications/href";
import { findNotification } from "@/lib/notifications/queries";
import { readMarkNow } from "@/lib/notifications/read-mark";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/validation/common";
import { parseNotificationId } from "@/lib/validation/notifications";

/**
 * Opens a notification: marks it as read and sends the person to what it is about (or back to the list if there is nowhere to go).
 * It is a plain link on purpose (a router link would be prefetched and mark everything as read without anyone opening it). The
 * database only shows and changes the person's own notifications, so someone else's id finds nothing.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const locale = parseLocale(request.nextUrl.searchParams.get("lang"));
  const id = parseNotificationId((await context.params).id);
  const item = id ? await findNotification(id) : null;
  let path = "/notifications";
  if (item) {
    const supabase = await createClient();
    await supabase.from("notifications").update(readMarkNow()).eq("id", item.id).is("read_at", null);
    path = notificationHref(item) ?? path;
  }
  const response = NextResponse.redirect(new URL(localizePath(locale, path), publicEnv.siteUrl), 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
