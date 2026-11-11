import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_UPDATED } from "@/lib/legal/status";
import { TERMS_VERSION } from "./terms";

const repoRoot = path.resolve(process.cwd(), "../..");

describe("terms version", () => {
  it("is the date of a legal change and never runs ahead of the texts", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TERMS_VERSION <= LEGAL_UPDATED).toBe(true);
  });

  it("is the one the example accounts of the seed have accepted, so they are never asked again on a fresh database", () => {
    const seed = readFileSync(path.join(repoRoot, "supabase/seeds/01-usuarios.sql"), "utf8");
    const accepted = [...seed.matchAll(/insert into public\.profile_private[^;]*?'es', '([^']+)'/g)].map((match) => match[1]);
    expect(accepted).toEqual([TERMS_VERSION]);
  });
});
