import { z } from "zod";

export const notificationIdSchema = z.object({ id: z.uuid("generic") });

/** The id of a notification from the address, or null if it is not one. */
export function parseNotificationId(value: unknown): string | null {
  const result = z.uuid().safeParse(value);
  return result.success ? result.data : null;
}
