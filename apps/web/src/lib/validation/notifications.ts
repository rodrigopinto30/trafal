import { z } from "zod";

export const notificationIdSchema = z.object({ id: z.uuid("generic") });

/** The most notifications a single action can change: the screen shows one page at a time, and a page is smaller than this. */
export const NOTIFICATIONS_BATCH_MAX = 50;

const notificationIds = z.array(z.uuid("generic")).min(1, "generic").max(NOTIFICATIONS_BATCH_MAX, "generic");

export const notificationBatchSchema = z.object({ ids: notificationIds });

export const notificationReadBatchSchema = z.object({ ids: notificationIds, read: z.boolean() });

/** The id of a notification from the address, or null if it is not one. */
export function parseNotificationId(value: unknown): string | null {
  const result = z.uuid().safeParse(value);
  return result.success ? result.data : null;
}
