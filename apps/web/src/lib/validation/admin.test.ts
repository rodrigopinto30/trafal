import { describe, expect, it } from "vitest";
import {
  ADMIN_ERROR_KEYS,
  FEATURED_QUOTE_MAX,
  MODERATION_NOTE_MAX,
  SUSPENSION_REASON_MAX,
  liftSuspensionSchema,
  moderateContentSchema,
  parseAccountFilter,
  parseAccountSearch,
  parseBefore,
  parseReportStatusFilter,
  resolveReportSchema,
  setFeaturedSchema,
  suspendAccountSchema,
} from "./admin";

const id = "11111111-1111-4111-8111-111111111111";

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);
}

describe("resolveReportSchema", () => {
  it("accepts the three outcomes and cleans the note", () => {
    for (const outcome of ["dismissed", "actioned", "hide_content"]) expect(messages(resolveReportSchema.safeParse({ reportId: id, outcome }))).toEqual([]);
    expect(resolveReportSchema.parse({ reportId: id, outcome: "dismissed", note: "  ok\n\n\n\nlisto  " }).note).toBe("ok\n\nlisto");
  });

  it("rejects unknown outcomes, bad ids and long notes", () => {
    expect(messages(resolveReportSchema.safeParse({ reportId: id, outcome: "delete" }))).toEqual(["invalidInput"]);
    expect(messages(resolveReportSchema.safeParse({ reportId: "x", outcome: "dismissed" }))).toEqual(["invalidInput"]);
    expect(messages(resolveReportSchema.safeParse({ reportId: id, outcome: "dismissed", note: "a".repeat(MODERATION_NOTE_MAX + 1) }))).toEqual(["noteTooLong"]);
  });
});

describe("moderateContentSchema", () => {
  it("only moderates by hiding or restoring games, posts and comments", () => {
    expect(messages(moderateContentSchema.safeParse({ targetType: "game", targetId: id, action: "hide", reason: "spam" }))).toEqual([]);
    expect(messages(moderateContentSchema.safeParse({ targetType: "profile", targetId: id, action: "hide", reason: "x" }))).toEqual(["invalidInput"]);
    expect(messages(moderateContentSchema.safeParse({ targetType: "game", targetId: id, action: "delete", reason: "x" }))).toEqual(["invalidInput"]);
  });
});

describe("setFeaturedSchema", () => {
  it("turns an empty week into null and validates the date and the quote", () => {
    expect(setFeaturedSchema.parse({ gameId: id, week: "" }).week).toBeNull();
    expect(setFeaturedSchema.parse({ gameId: id, week: "2026-11-09" }).week).toBe("2026-11-09");
    expect(messages(setFeaturedSchema.safeParse({ gameId: id, week: "09/11/2026" }))).toContain("invalidInput");
    expect(messages(setFeaturedSchema.safeParse({ gameId: id, quote: "a".repeat(FEATURED_QUOTE_MAX + 1) }))).toEqual(["quoteTooLong"]);
  });
});

describe("suspendAccountSchema and liftSuspensionSchema", () => {
  it("accepts every duration and cleans the reason", () => {
    for (const duration of ["1", "7", "30", "90", "forever"]) expect(messages(suspendAccountSchema.safeParse({ userId: id, reason: "Insultos", duration }))).toEqual([]);
    expect(suspendAccountSchema.parse({ userId: id, reason: "  Insultos\n\n\n\nrepetidos  ", duration: "7" }).reason).toBe("Insultos\n\nrepetidos");
  });

  it("needs a reason, of up to 500 characters", () => {
    expect(messages(suspendAccountSchema.safeParse({ userId: id, reason: "   ", duration: "7" }))).toEqual(["reasonRequired"]);
    expect(messages(suspendAccountSchema.safeParse({ userId: id, reason: "a".repeat(SUSPENSION_REASON_MAX), duration: "7" }))).toEqual([]);
    expect(messages(suspendAccountSchema.safeParse({ userId: id, reason: "a".repeat(SUSPENSION_REASON_MAX + 1), duration: "7" }))).toEqual(["reasonTooLong"]);
    expect(messages(liftSuspensionSchema.safeParse({ userId: id, reason: "" }))).toEqual(["reasonRequired"]);
  });

  it("rejects durations that are not offered and ids that are not uuids", () => {
    expect(messages(suspendAccountSchema.safeParse({ userId: id, reason: "x", duration: "365" }))).toEqual(["invalidInput"]);
    expect(messages(suspendAccountSchema.safeParse({ userId: id, reason: "x", duration: "-1" }))).toEqual(["invalidInput"]);
    expect(messages(suspendAccountSchema.safeParse({ userId: "x", reason: "x", duration: "7" }))).toEqual(["invalidInput"]);
  });
});

describe("accounts search from the address", () => {
  it("keeps letters, numbers, underscores and spaces only, and cuts it short", () => {
    expect(parseAccountSearch("  valen_makes  ")).toBe("valen_makes");
    expect(parseAccountSearch("José  Pérez")).toBe("José Pérez");
    expect(parseAccountSearch("a%b,c(d)\"e\\f")).toBe("abcdef");
    expect(parseAccountSearch("a".repeat(80))).toHaveLength(50);
    expect(parseAccountSearch(undefined)).toBe("");
    expect(parseAccountSearch(["x"])).toBe("");
  });

  it("falls back to «all» for unknown filters", () => {
    expect(parseAccountFilter("suspended")).toBe("suspended");
    expect(parseAccountFilter("admins")).toBe("all");
    expect(parseAccountFilter(undefined)).toBe("all");
  });
});

describe("address parsing", () => {
  it("falls back to «open» for unknown filters", () => {
    expect(parseReportStatusFilter("resolved")).toBe("resolved");
    expect(parseReportStatusFilter("x")).toBe("open");
    expect(parseReportStatusFilter(undefined)).toBe("open");
  });

  it("only accepts ISO dates as cursor", () => {
    expect(parseBefore("2026-11-09T10:00:00.000Z")).toBe("2026-11-09T10:00:00.000Z");
    expect(parseBefore("ayer")).toBeNull();
    expect(parseBefore(undefined)).toBeNull();
  });

  it("only uses error keys the screens know how to translate", () => {
    for (const message of [...messages(resolveReportSchema.safeParse({})), ...messages(setFeaturedSchema.safeParse({}))]) expect(ADMIN_ERROR_KEYS).toContain(message);
  });
});
