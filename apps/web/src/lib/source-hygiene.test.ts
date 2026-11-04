import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * «Trojan Source» (CVE-2021-42574): caracteres de dirección de escritura o invisibles escondidos en el código hacen que
 * lo que se LEE en una revisión no sea lo que se EJECUTA. Además, U+2028/U+2029 son saltos de línea para JavaScript y
 * rompen cadenas y expresiones regulares sin que se note. En el código se escriben siempre como escapes (U+202E).
 */
const FORBIDDEN = new Set<number>([
  0x200b, 0x2060, 0xfeff, 0x2028, 0x2029, 0x0085,
  ...Array.from({ length: 5 }, (_, i) => 0x202a + i), // LRE, RLE, PDF, LRO, RLO
  ...Array.from({ length: 4 }, (_, i) => 0x2066 + i), // LRI, RLI, FSI, PDI
]);

const SRC = path.resolve(process.cwd(), "src");
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".mts"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : EXTENSIONS.has(path.extname(name)) ? [full] : [];
  });
}

describe("higiene del código fuente", () => {
  it("ningún archivo de src/ trae caracteres invisibles o de dirección de escritura literales", () => {
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      const text = readFileSync(file, "utf8");
      const found = [...new Set([...text].filter((char) => FORBIDDEN.has(char.codePointAt(0) as number)))];
      if (found.length > 0) {
        offenders.push(`${path.relative(SRC, file)}: ${found.map((char) => "U+" + (char.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0")).join(", ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("el escaneo ve los archivos (no pasa en vacío)", () => {
    expect(files(SRC).length).toBeGreaterThan(50);
  });
});
