import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { GENRE_IDS } from "@/lib/profile/catalog";
import { parse } from "./format";

type Json = { [key: string]: string | Json };

function flatten(obj: Json, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

/** Nombres de variables y etiquetas que usa un mensaje (para comprobar que es/en coinciden). */
function placeholders(message: string): string[] {
  const names = new Set<string>();
  const walk = (nodes: ReturnType<typeof parse>) => {
    for (const node of nodes) {
      if (node.t === "arg") names.add(`{${node.name}}`);
      if (node.t === "plural" || node.t === "select") {
        names.add(`{${node.name}}`);
        Object.values(node.cases).forEach(walk);
      }
      if (node.t === "tag") {
        names.add(`<${node.name}>`);
        walk(node.children);
      }
    }
  };
  walk(parse(message));
  return [...names].sort();
}

const esFlat = flatten(es as Json);
const enFlat = flatten(en as Json);

describe("mensajes es/en", () => {
  it("tienen exactamente las mismas claves", () => {
    const missingInEn = Object.keys(esFlat).filter((k) => !(k in enFlat));
    const missingInEs = Object.keys(enFlat).filter((k) => !(k in esFlat));
    expect({ missingInEn, missingInEs }).toEqual({ missingInEn: [], missingInEs: [] });
  });

  it("no tienen textos vacíos", () => {
    const empty = [...Object.entries(esFlat), ...Object.entries(enFlat)].filter(([, v]) => v.trim() === "");
    expect(empty).toEqual([]);
  });

  it("todos los mensajes se pueden parsear", () => {
    for (const [key, value] of [...Object.entries(esFlat), ...Object.entries(enFlat)]) {
      expect(() => parse(value), key).not.toThrow();
    }
  });

  it("usan las mismas variables y etiquetas en los dos idiomas", () => {
    const mismatches = Object.keys(esFlat)
      .filter((key) => key in enFlat)
      .filter((key) => placeholders(esFlat[key] as string).join() !== placeholders(enFlat[key] as string).join())
      .map((key) => ({ key, es: placeholders(esFlat[key] as string), en: placeholders(enFlat[key] as string) }));
    expect(mismatches).toEqual([]);
  });

  it("el español usa voseo, no tuteo", () => {
    // Formas de tuteo que en el voseo rioplatense son otras (tenés, podés, querés, necesitás, sos...).
    const tuteo = /\b(tú|tienes|puedes|quieres|necesitas|eres|haz clic|elige|escribe|ingresa tu|revisa)\b/i;
    const offenders = Object.entries(esFlat)
      .filter(([, value]) => tuteo.test(value))
      .map(([key, value]) => `${key}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it("los catálogos tienen un nombre para cada género (ids verificados contra las migraciones en catalog.test.ts)", () => {
    expect(Object.keys(es.genres).sort()).toEqual([...GENRE_IDS].sort());
  });
});
