import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { BASE_CLIENT_NAMESPACES, CLIENT_NAMESPACES } from "./messages";

const SOURCE = path.resolve(process.cwd(), "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("textos que viajan al navegador", () => {
  it("cada namespace que usa un componente de cliente está en la lista de los que pueden viajar", () => {
    const used = new Map<string, string[]>();
    for (const file of sourceFiles(SOURCE)) {
      const text = readFileSync(file, "utf8");
      if (!text.startsWith('"use client"')) continue;
      for (const match of text.matchAll(/useTranslations\("(\w+)"\)/g)) {
        const namespace = match[1] ?? "";
        used.set(namespace, [...(used.get(namespace) ?? []), path.relative(SOURCE, file)]);
      }
    }
    const missing = [...used].filter(([namespace]) => !(CLIENT_NAMESPACES as readonly string[]).includes(namespace));
    expect(missing).toEqual([]);
  });

  it("la base es chica y todo lo que viaja existe en español y en inglés", () => {
    expect(BASE_CLIENT_NAMESPACES.length).toBeLessThanOrEqual(10);
    for (const namespace of CLIENT_NAMESPACES) {
      expect(namespace in es, `${namespace} en es`).toBe(true);
      expect(namespace in en, `${namespace} en en`).toBe(true);
    }
    const baseBytes = BASE_CLIENT_NAMESPACES.reduce((total, namespace) => total + JSON.stringify((es as Record<string, unknown>)[namespace]).length, 0);
    expect(baseBytes).toBeLessThan(10_000);
  });

  it("los namespaces de los formularios y de las pantallas de la cuenta no viajan en todas las páginas", () => {
    for (const heavy of ["auth", "onboarding", "settings", "gameForm", "gameVersions", "gamePlayer", "comments", "genres", "engines"]) {
      expect((BASE_CLIENT_NAMESPACES as readonly string[]).includes(heavy), heavy).toBe(false);
    }
  });
});
