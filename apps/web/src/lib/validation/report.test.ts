import { describe, expect, it } from "vitest";
import { REPORT_ERROR_KEYS, REPORT_REASONS, reportGameSchema } from "./report";

const gameId = "11111111-1111-4111-8111-111111111111";

function messages(input: Record<string, unknown>): string[] {
  const result = reportGameSchema.safeParse({ gameId, reason: "broken", detail: "", ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("reportGameSchema", () => {
  it("accepts every known reason and cleans the detail", () => {
    for (const reason of REPORT_REASONS) expect(messages({ reason })).toEqual([]);
    const parsed = reportGameSchema.parse({ gameId, reason: "other", detail: "  No carga\n\n\n\nel nivel 2  " });
    expect(parsed.detail).toBe("No carga\n\nel nivel 2");
  });

  it("rejects unknown reasons and ids that are not uuids", () => {
    expect(messages({ reason: "because" })).toEqual(["invalidReason"]);
    expect(messages({ reason: "" })).toEqual(["invalidReason"]);
    expect(messages({ gameId: "orbita" })).toEqual(["generic"]);
  });

  it("limits the detail to 1000 characters", () => {
    expect(messages({ detail: "a".repeat(1000) })).toEqual([]);
    expect(messages({ detail: "a".repeat(1001) })).toEqual(["detailTooLong"]);
  });

  it("only uses error keys the form knows how to translate", () => {
    for (const message of [...messages({ reason: "x" }), ...messages({ gameId: "x" }), ...messages({ detail: "a".repeat(2000) })]) {
      expect(REPORT_ERROR_KEYS as readonly string[]).toContain(message);
    }
  });
});
