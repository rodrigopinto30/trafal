import { describe, expect, it } from "vitest";
import { weekStartOf } from "./featured";

describe("weekStartOf", () => {
  it.each([
    ["2026-11-09T00:00:00Z", "2026-11-09"],
    ["2026-11-09T23:59:59Z", "2026-11-09"],
    ["2026-11-10T12:00:00Z", "2026-11-09"],
    ["2026-11-15T23:59:59Z", "2026-11-09"],
    ["2026-11-16T00:00:00Z", "2026-11-16"],
    ["2026-11-08T10:00:00Z", "2026-11-02"],
    ["2027-01-01T00:00:00Z", "2026-12-28"],
    ["2024-03-01T00:00:00Z", "2024-02-26"],
  ])("%s falls in the week that starts on %s", (instant, monday) => {
    expect(weekStartOf(new Date(instant))).toBe(monday);
  });

  it("always answers a Monday", () => {
    for (let offset = 0; offset < 400; offset++) {
      const date = new Date(Date.UTC(2026, 0, 1 + offset, 13));
      expect(new Date(`${weekStartOf(date)}T00:00:00Z`).getUTCDay()).toBe(1);
    }
  });
});
