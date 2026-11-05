import { describe, expect, it } from "vitest";
import { formatCompactNumber, formatRelativeTime } from "./format";

const now = new Date("2026-11-05T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("formatRelativeTime", () => {
  it.each([
    [30, "ahora"],
    [5 * 60, "hace 5 minutos"],
    [3 * 3600, "hace 3 horas"],
    [24 * 3600, "ayer"],
    [3 * 24 * 3600, "hace 3 días"],
    [14 * 24 * 3600, "hace 2 semanas"],
    [65 * 24 * 3600, "hace 2 meses"],
  ])("en español, hace %i segundos → %s", (seconds, expected) => {
    expect(formatRelativeTime("es", ago(seconds), now)).toBe(expected);
  });

  it("en inglés", () => {
    expect(formatRelativeTime("en", ago(3 * 3600), now)).toBe("3 hours ago");
    expect(formatRelativeTime("en", ago(24 * 3600), now)).toBe("yesterday");
  });

  it("acepta fechas como texto", () => {
    expect(formatRelativeTime("es", "2026-11-05T09:00:00Z", now)).toBe("hace 3 horas");
  });
});

const withPlainSpaces = (text: string) => text.replace(/\s/g, " ");

describe("formatCompactNumber", () => {
  it("abrevia según el idioma", () => {
    expect(withPlainSpaces(formatCompactNumber("es", 6120))).toBe("6,1 mil");
    expect(formatCompactNumber("en", 6120)).toBe("6.1K");
    expect(formatCompactNumber("es", 87)).toBe("87");
  });
});
