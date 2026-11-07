import { describe, expect, it } from "vitest";
import { reactionSchema } from "./reaction";

const ID = "11111111-1111-4111-8111-111111111101";

describe("reactionSchema", () => {
  it.each([
    ["game", "like"],
    ["game", "save"],
    ["post", "like"],
    ["post", "save"],
  ])("accepts %s %s", (target, kind) => {
    expect(reactionSchema.safeParse({ target, kind, id: ID, active: true }).success).toBe(true);
    expect(reactionSchema.safeParse({ target, kind, id: ID, active: false }).success).toBe(true);
  });

  it.each([
    [{ target: "comment", kind: "like", id: ID, active: true }],
    [{ target: "game", kind: "love", id: ID, active: true }],
    [{ target: "game", kind: "like", id: "not-a-uuid", active: true }],
    [{ target: "game", kind: "like", id: ID, active: "yes" }],
    [{ target: "game", kind: "like", id: ID }],
    [{ target: "game; drop table games", kind: "like", id: ID, active: true }],
    [null],
    ["like"],
  ])("rejects %j", (input) => {
    expect(reactionSchema.safeParse(input).success).toBe(false);
  });
});
