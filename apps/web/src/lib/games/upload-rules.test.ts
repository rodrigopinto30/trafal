import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DAILY_UPLOAD_LIMIT, MAX_ZIP_BYTES, looksLikeZip } from "./upload-rules";
import { UPLOAD_ERROR_CODES, isUploadErrorCode, uploadErrorParams } from "./upload-error";

const repoRoot = path.resolve(process.cwd(), "../..");
const rules = JSON.parse(readFileSync(path.join(repoRoot, "packages/shared/upload-rules.json"), "utf8")) as {
  limits: { maxZipBytes: number };
  errorCodes: string[];
};
const migration = readFileSync(path.join(repoRoot, "supabase/migrations/20261106000200_game_upload.sql"), "utf8");

describe("upload limits stay in sync", () => {
  it("the client zip limit equals the shared rules and the SQL function", () => {
    expect(MAX_ZIP_BYTES).toBe(rules.limits.maxZipBytes);
    expect(migration).toContain(`c_max_zip_bytes constant bigint := ${MAX_ZIP_BYTES};`);
  });

  it("the daily upload quota equals the SQL function", () => {
    expect(migration).toContain(`c_daily_uploads constant integer := ${DAILY_UPLOAD_LIMIT};`);
  });

  it("the validator error codes known by the app are exactly the ones in the shared rules", () => {
    expect([...UPLOAD_ERROR_CODES].sort()).toEqual([...rules.errorCodes].sort());
  });
});

describe("looksLikeZip", () => {
  it("accepts any casing of .zip and nothing else", () => {
    expect(looksLikeZip("game.zip")).toBe(true);
    expect(looksLikeZip("GAME.ZIP")).toBe(true);
    for (const name of ["game.rar", "game.zip.exe", "zip", "game.zipx", ""]) expect(looksLikeZip(name)).toBe(false);
  });
});

describe("uploadErrorParams", () => {
  it("formats byte limits for people and leaves counts alone", () => {
    expect(uploadErrorParams("en", "ZIP_TOO_LARGE", { limit: 209715200 })).toEqual({ limit: "200 MB" });
    expect(uploadErrorParams("en", "TOO_MANY_FILES", { limit: 5000 })).toEqual({ limit: 5000 });
    expect(uploadErrorParams("en", "PATH_TOO_LONG", { path: "a/b", limit: 240 })).toEqual({ path: "a/b", limit: 240 });
  });

  it("keeps only strings and numbers, and tolerates anything else", () => {
    expect(uploadErrorParams("en", "UNSAFE_PATH", { path: "x", nested: { a: 1 }, list: [1], flag: true })).toEqual({ path: "x" });
    for (const value of [null, undefined, "text", 5, ["a"]]) expect(uploadErrorParams("en", "NOT_A_ZIP", value)).toEqual({});
  });
});

describe("isUploadErrorCode", () => {
  it("only accepts the known codes", () => {
    expect(isUploadErrorCode("NO_INDEX_HTML")).toBe(true);
    for (const value of ["no_index_html", "UPLOAD_EXPIRED", "", null, undefined, 3]) expect(isUploadErrorCode(value)).toBe(false);
  });
});
