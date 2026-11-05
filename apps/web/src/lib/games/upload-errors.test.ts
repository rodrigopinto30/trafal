import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const rulesPath = path.resolve(process.cwd(), "../../packages/shared/upload-rules.json");
const rules = JSON.parse(readFileSync(rulesPath, "utf8")) as { errorCodes: string[] };

const KNOWN_PLACEHOLDERS = new Set(["path", "extension", "limit", "file"]);

function placeholdersOf(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "");
}

describe.each([
  ["es", es.uploadErrors],
  ["en", en.uploadErrors],
])("mensajes de errores de subida (%s)", (_language, messages) => {
  it("hay un mensaje por cada código de error de las reglas compartidas, y ninguno de más", () => {
    expect(Object.keys(messages).sort()).toEqual([...rules.errorCodes].sort());
  });

  it("solo usan parámetros que el validador sabe entregar", () => {
    for (const message of Object.values(messages)) {
      for (const name of placeholdersOf(message)) expect(KNOWN_PLACEHOLDERS.has(name)).toBe(true);
    }
  });

  it("no dejan de explicar qué hacer: terminan en punto", () => {
    for (const message of Object.values(messages)) expect(message.trim().endsWith(".")).toBe(true);
  });
});

describe("reglas de subida compartidas", () => {
  it("los códigos son únicos", () => {
    expect(new Set(rules.errorCodes).size).toBe(rules.errorCodes.length);
  });
});
