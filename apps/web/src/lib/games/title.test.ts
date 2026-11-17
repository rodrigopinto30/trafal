import { describe, expect, it } from "vitest";
import { isTitleTaken } from "./title";

describe("isTitleTaken", () => {
  it("recognizes the unique name index", () => {
    expect(isTitleTaken({ code: "23505", message: 'duplicate key value violates unique constraint "games_title_unique"' })).toBe(true);
  });

  it("ignores other unique violations and other errors", () => {
    expect(isTitleTaken({ code: "23505", message: 'duplicate key value violates unique constraint "games_public_id_key"' })).toBe(false);
    expect(isTitleTaken({ code: "42501", message: "games_title_unique" })).toBe(false);
    expect(isTitleTaken(null)).toBe(false);
  });
});
