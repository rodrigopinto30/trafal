import { describe, expect, it } from "vitest";
import { REPORT_ERROR_KEYS, REPORT_REASONS, REPORT_REASONS_BY_TARGET, REPORT_TARGETS, reportSchema } from "./report";

const targetId = "11111111-1111-4111-8111-111111111111";

function messages(input: Record<string, unknown>): string[] {
  const result = reportSchema.safeParse({ targetType: "game", targetId, reason: "broken", detail: "", ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("reportSchema", () => {
  it("accepts every reason of every kind of content and cleans the detail", () => {
    for (const targetType of REPORT_TARGETS) {
      for (const reason of REPORT_REASONS_BY_TARGET[targetType]) expect(messages({ targetType, reason })).toEqual([]);
    }
    const parsed = reportSchema.parse({ targetType: "game", targetId, reason: "other", detail: "  No carga\n\n\n\nel nivel 2  " });
    expect(parsed.detail).toBe("No carga\n\nel nivel 2");
  });

  it("only offers «It does not work» for games", () => {
    expect(messages({ targetType: "game", reason: "broken" })).toEqual([]);
    for (const targetType of ["post", "comment", "profile"]) expect(messages({ targetType, reason: "broken" })).toEqual(["invalidReason"]);
    expect(messages({ targetType: "comment", reason: "copyright" })).toEqual(["invalidReason"]);
    expect(messages({ targetType: "post", reason: "copyright" })).toEqual([]);
  });

  it("every reason of every kind is a known reason", () => {
    for (const targetType of REPORT_TARGETS) for (const reason of REPORT_REASONS_BY_TARGET[targetType]) expect(REPORT_REASONS).toContain(reason);
  });

  it("rejects unknown reasons, unknown kinds and ids that are not uuids", () => {
    expect(messages({ reason: "because" })).toEqual(["invalidReason"]);
    expect(messages({ reason: "" })).toEqual(["invalidReason"]);
    expect(messages({ targetId: "orbita" })).toEqual(["generic"]);
    expect(messages({ targetType: "report" })).toEqual(["generic"]);
  });

  it("limits the detail to 1000 characters", () => {
    expect(messages({ detail: "a".repeat(1000) })).toEqual([]);
    expect(messages({ detail: "a".repeat(1001) })).toEqual(["detailTooLong"]);
  });

  it("only uses error keys the form knows how to translate", () => {
    for (const message of [...messages({ reason: "x" }), ...messages({ targetId: "x" }), ...messages({ detail: "a".repeat(2000) })]) {
      expect(REPORT_ERROR_KEYS as readonly string[]).toContain(message);
    }
  });
});
