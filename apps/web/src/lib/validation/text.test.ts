import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RAW_TEXT_MAX, sanitizeLine, sanitizeMultiline } from "./text";

const migration = readFileSync(path.resolve(process.cwd(), "../../supabase/migrations/20261119000300_security_hardening.sql"), "utf8");

/** Every code point the database rejects in public text (the character class of private.has_hidden_chars). */
function codePointsTheDatabaseRejects(): number[] {
  const match = /function private\.has_hidden_chars\(p_text text\)[\s\S]*?p_text ~ '\[([^\]]+)\]'/.exec(migration);
  if (!match?.[1]) throw new Error("private.has_hidden_chars not found in the migration");
  const points: number[] = [];
  for (const [, from, to] of match[1].matchAll(/\\u([0-9A-F]{4})(?:-\\u([0-9A-F]{4}))?/g)) {
    const start = Number.parseInt(from ?? "", 16);
    const end = to ? Number.parseInt(to, 16) : start;
    for (let point = start; point <= end; point += 1) points.push(point);
  }
  return points;
}

describe("text cleaning", () => {
  it("takes linear time even on a huge run of spaces (it used to take minutes)", () => {
    const attack = " ".repeat(1_000_000) + "x";
    const started = performance.now();
    sanitizeMultiline(attack);
    sanitizeLine(attack);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("cuts what is far longer than any field before cleaning it", () => {
    expect(sanitizeLine("a".repeat(RAW_TEXT_MAX + 10))).toHaveLength(RAW_TEXT_MAX);
  });

  it("still drops the spaces at the end of each line and keeps at most one blank line", () => {
    expect(sanitizeMultiline("uno  \t\ndos \n\n\n\n tres  ")).toBe("uno\ndos\n\n tres");
  });

  it("removes every character the database rejects, so a form never trips over a database check", () => {
    const rejected = codePointsTheDatabaseRejects();
    expect(rejected.length).toBeGreaterThan(40);
    for (const point of rejected) {
      const character = String.fromCodePoint(point);
      expect(sanitizeLine(`a${character}b`), `U+${point.toString(16)}`).not.toContain(character);
      if (point !== 0x0a) expect(sanitizeMultiline(`a${character}b`), `U+${point.toString(16)}`).not.toContain(character);
    }
  });

  it("keeps the joiners that emoji and some scripts need", () => {
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    expect(sanitizeLine(`Familia ${family}`)).toBe(`Familia ${family}`);
    expect(sanitizeLine("می‌خواهم")).toContain("‌");
    expect(sanitizeLine("❤️")).toBe("❤️");
  });
});
