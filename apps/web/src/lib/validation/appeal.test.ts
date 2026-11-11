import { describe, expect, it } from "vitest";
import { counterNoticeSchema, parseAppealFilter, resolveAppealSchema, submitAppealSchema } from "./appeal";

const id = "11111111-1111-4111-8111-111111111111";

describe("submitAppealSchema", () => {
  it("accepts a message about a decision and cleans it", () => {
    const parsed = submitAppealSchema.parse({ targetType: "game", targetId: id, message: "  It is my own work \u0000 " });
    expect(parsed.message).toBe("It is my own work");
  });

  it("needs a message that is not blank and not too long", () => {
    expect(submitAppealSchema.safeParse({ targetType: "game", targetId: id, message: "   " }).error?.issues[0]?.message).toBe("messageRequired");
    expect(submitAppealSchema.safeParse({ targetType: "game", targetId: id, message: "x".repeat(1001) }).error?.issues[0]?.message).toBe("messageTooLong");
  });

  it("only knows what can be moderated", () => {
    expect(submitAppealSchema.safeParse({ targetType: "report", targetId: id, message: "x" }).success).toBe(false);
    expect(submitAppealSchema.safeParse({ targetType: "game", targetId: "nope", message: "x" }).success).toBe(false);
  });
});

describe("counterNoticeSchema", () => {
  const valid = { targetType: "game", targetId: id, message: "I drew it myself", name: "  Ana  Maker ", email: " Ana@Example.COM ", goodFaith: true, accuracy: true };

  it("cleans the name and the email", () => {
    const parsed = counterNoticeSchema.parse(valid);
    expect(parsed.name).toBe("Ana Maker");
    expect(parsed.email).toBe("ana@example.com");
  });

  it("only exists for games and updates", () => {
    expect(counterNoticeSchema.safeParse({ ...valid, targetType: "comment" }).success).toBe(false);
    expect(counterNoticeSchema.safeParse({ ...valid, targetType: "post" }).success).toBe(true);
  });

  it("needs a message, a name, a real email and both statements", () => {
    const first = (input: object) => counterNoticeSchema.safeParse(input).error?.issues[0]?.message;
    expect(first({ ...valid, message: "  " })).toBe("messageRequired");
    expect(first({ ...valid, name: "  " })).toBe("nameRequired");
    expect(first({ ...valid, name: "x".repeat(201) })).toBe("nameRequired");
    expect(first({ ...valid, email: "not an email" })).toBe("invalidEmail");
    expect(first({ ...valid, goodFaith: false })).toBe("statementsRequired");
    expect(first({ ...valid, accuracy: false })).toBe("statementsRequired");
  });
});

describe("resolveAppealSchema", () => {
  it("needs an outcome and an answer", () => {
    expect(resolveAppealSchema.safeParse({ appealId: id, outcome: "upheld", note: "The rules were broken" }).success).toBe(true);
    expect(resolveAppealSchema.safeParse({ appealId: id, outcome: "maybe", note: "x" }).error?.issues[0]?.message).toBe("invalidInput");
    expect(resolveAppealSchema.safeParse({ appealId: id, outcome: "overturned", note: "  " }).error?.issues[0]?.message).toBe("reasonRequired");
    expect(resolveAppealSchema.safeParse({ appealId: id, outcome: "overturned", note: "x".repeat(1001) }).error?.issues[0]?.message).toBe("noteTooLong");
  });
});

describe("parseAppealFilter", () => {
  it("falls back to the open ones", () => {
    expect(parseAppealFilter("resolved")).toBe("resolved");
    expect(parseAppealFilter("anything")).toBe("open");
    expect(parseAppealFilter(undefined)).toBe("open");
  });
});
