import { describe, expect, it } from "vitest";
import { parseBefore } from "./common";
import { NOTIFICATIONS_BATCH_MAX, notificationBatchSchema, notificationIdSchema, notificationReadBatchSchema, parseNotificationId } from "./notifications";

const id = "11111111-1111-4111-8111-111111111111";

describe("notification ids and cursors", () => {
  it("only accepts uuids", () => {
    expect(parseNotificationId(id)).toBe(id);
    for (const value of ["", "1", "../../etc", id + "x", undefined, null, ["x"]]) expect(parseNotificationId(value)).toBeNull();
    expect(notificationIdSchema.safeParse({ id }).success).toBe(true);
    expect(notificationIdSchema.safeParse({ id: "x" }).success).toBe(false);
  });

  it("a selection has between one and the maximum number of uuids", () => {
    expect(notificationBatchSchema.safeParse({ ids: [id] }).success).toBe(true);
    expect(notificationBatchSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(notificationBatchSchema.safeParse({ ids: [id, "x"] }).success).toBe(false);
    expect(notificationBatchSchema.safeParse({ ids: Array(NOTIFICATIONS_BATCH_MAX).fill(id) }).success).toBe(true);
    expect(notificationBatchSchema.safeParse({ ids: Array(NOTIFICATIONS_BATCH_MAX + 1).fill(id) }).success).toBe(false);
    expect(notificationReadBatchSchema.safeParse({ ids: [id], read: false }).success).toBe(true);
    expect(notificationReadBatchSchema.safeParse({ ids: [id] }).success).toBe(false);
  });

  it("only accepts ISO dates as the cursor of a page", () => {
    expect(parseBefore("2026-11-10T10:00:00.000Z")).toBe("2026-11-10T10:00:00.000Z");
    expect(parseBefore("ayer")).toBeNull();
  });
});
