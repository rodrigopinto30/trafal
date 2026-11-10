import { describe, expect, it } from "vitest";
import { parseBefore } from "./common";
import { notificationIdSchema, parseNotificationId } from "./notifications";

const id = "11111111-1111-4111-8111-111111111111";

describe("notification ids and cursors", () => {
  it("only accepts uuids", () => {
    expect(parseNotificationId(id)).toBe(id);
    for (const value of ["", "1", "../../etc", id + "x", undefined, null, ["x"]]) expect(parseNotificationId(value)).toBeNull();
    expect(notificationIdSchema.safeParse({ id }).success).toBe(true);
    expect(notificationIdSchema.safeParse({ id: "x" }).success).toBe(false);
  });

  it("only accepts ISO dates as the cursor of a page", () => {
    expect(parseBefore("2026-11-10T10:00:00.000Z")).toBe("2026-11-10T10:00:00.000Z");
    expect(parseBefore("ayer")).toBeNull();
  });
});
