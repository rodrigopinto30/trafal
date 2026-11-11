import { describe, expect, it } from "vitest";
import { unreadBadgeText } from "./unread";

describe("unreadBadgeText", () => {
  it("shows the exact number up to 99", () => {
    expect(unreadBadgeText(1)).toBe("1");
    expect(unreadBadgeText(99)).toBe("99");
  });

  it("caps anything above 99", () => {
    expect(unreadBadgeText(100)).toBe("99+");
    expect(unreadBadgeText(114)).toBe("99+");
  });
});
