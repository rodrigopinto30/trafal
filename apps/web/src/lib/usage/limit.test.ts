import { describe, expect, it } from "vitest";
import { isUsageLimitError } from "./limit";

describe("isUsageLimitError", () => {
  it("recognizes the refusal of the database", () => {
    expect(isUsageLimitError({ message: "usage_limit_exceeded" })).toBe(true);
    expect(isUsageLimitError({ message: "ERROR: usage_limit_exceeded" })).toBe(true);
  });

  it("does not take anything else for it", () => {
    expect(isUsageLimitError({ message: "permission denied for table comments" })).toBe(false);
    expect(isUsageLimitError({ message: "daily_limit_reached" })).toBe(false);
    expect(isUsageLimitError({})).toBe(false);
    expect(isUsageLimitError(null)).toBe(false);
    expect(isUsageLimitError(undefined)).toBe(false);
  });
});
