import { describe, expect, it } from "vitest";
import { VERSION_ERROR_KEYS, editVersionSchema, gameDetailsSchema, newVersionSchema, zipDeclarationSchema } from "./game";

const valid = {
  title: "  Moon   Runner ",
  shortDescription: "Run on the moon",
  genre: "platformer",
  tags: "Pixel Art, RETRO, retro,  ",
  controls: "Arrows to move\n\n\n\nSpace to jump",
  questions: ["", "  Does the jump feel good? ", ""],
};

function issues(input: Record<string, unknown>): string[] {
  const result = gameDetailsSchema.safeParse({ ...valid, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("gameDetailsSchema", () => {
  it("cleans valid input", () => {
    const result = gameDetailsSchema.parse(valid);
    expect(result.title).toBe("Moon Runner");
    expect(result.tags).toEqual(["pixel art", "retro"]);
    expect(result.controls).toBe("Arrows to move\n\nSpace to jump");
    expect(result.questions).toEqual(["Does the jump feel good?"]);
  });

  it("requires a title of 1 to 80 characters", () => {
    expect(issues({ title: "   " })).toEqual(["invalidTitle"]);
    expect(issues({ title: "a".repeat(81) })).toEqual(["invalidTitle"]);
    expect(issues({ title: "a".repeat(80) })).toEqual([]);
  });

  it("limits the description to 160 characters", () => {
    expect(issues({ shortDescription: "a".repeat(161) })).toEqual(["descriptionTooLong"]);
  });

  it("only accepts known genres", () => {
    expect(issues({ genre: "nope" })).toEqual(["invalidGenre"]);
    expect(issues({ genre: "" })).toEqual(["invalidGenre"]);
  });

  it("limits tags to 8 of up to 24 characters", () => {
    expect(issues({ tags: "a,b,c,d,e,f,g,h,i" })).toEqual(["tooManyTags"]);
    expect(issues({ tags: "a,b,c,d,e,f,g,h" })).toEqual([]);
    expect(issues({ tags: "x".repeat(25) })).toEqual(["tagTooLong"]);
  });

  it("limits how-to-play to 500 characters", () => {
    expect(issues({ controls: "a".repeat(501) })).toEqual(["controlsTooLong"]);
  });

  it("accepts up to 3 questions of 3 to 140 characters, ignoring empty ones", () => {
    expect(issues({ questions: ["abc", "def", "ghi", "jkl"] })).toEqual(["tooManyQuestions"]);
    expect(issues({ questions: ["ab"] })).toEqual(["questionLength"]);
    expect(issues({ questions: ["a".repeat(141)] })).toEqual(["questionLength"]);
    expect(issues({ questions: ["", "", ""] })).toEqual([]);
  });

  it("strips invisible and control characters", () => {
    const sneaky = ["Ad", String.fromCharCode(0x202e), "min"].join("");
    expect(gameDetailsSchema.parse({ ...valid, title: sneaky }).title).toBe("Admin");
  });
});

describe("zipDeclarationSchema", () => {
  const parse = (zipName: string, zipSize: unknown) => zipDeclarationSchema.safeParse({ zipName, zipSize });

  it("accepts a zip within the limit", () => {
    expect(parse("game.zip", "1048576").success).toBe(true);
    expect(parse("GAME.ZIP", String(200 * 1024 * 1024)).success).toBe(true);
  });

  it("rejects other extensions, empty and oversized files", () => {
    const messages = (name: string, size: unknown) => {
      const result = parse(name, size);
      return result.success ? [] : result.error.issues.map((issue) => issue.message);
    };
    expect(messages("game.rar", "10")).toEqual(["zipNotZip"]);
    expect(messages("game.zip", "0")).toEqual(["zipRequired"]);
    expect(messages("game.zip", String(200 * 1024 * 1024 + 1))).toEqual(["zipTooLarge"]);
  });
});

describe("version schemas", () => {
  const gameId = "11111111-1111-4111-8111-111111111111";
  const messages = (schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, input: unknown) => {
    const result = schema.safeParse(input);
    return result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);
  };

  it("a new version may leave its name and changelog empty", () => {
    expect(newVersionSchema.parse({ gameId, label: "", changelog: "" })).toEqual({ gameId, label: "", changelog: "" });
  });

  it("cleans the name and the changelog", () => {
    const parsed = newVersionSchema.parse({ gameId, label: "  v0.2   beta ", changelog: " Nuevo nivel\n\n\n\nY arreglos " });
    expect(parsed.label).toBe("v0.2 beta");
    expect(parsed.changelog).toBe("Nuevo nivel\n\nY arreglos");
  });

  it("limits the name to 24 characters and the changelog to 2000", () => {
    expect(messages(newVersionSchema, { gameId, label: "a".repeat(25), changelog: "" })).toEqual(["labelTooLong"]);
    expect(messages(newVersionSchema, { gameId, label: "a".repeat(24), changelog: "" })).toEqual([]);
    expect(messages(newVersionSchema, { gameId, label: "", changelog: "a".repeat(2001) })).toEqual(["changelogTooLong"]);
  });

  it("an edit needs a name of 1 to 24 characters", () => {
    const versionId = gameId;
    expect(messages(editVersionSchema, { versionId, label: "   ", changelog: "" })).toEqual(["invalidLabel"]);
    expect(messages(editVersionSchema, { versionId, label: "a".repeat(25), changelog: "" })).toEqual(["invalidLabel"]);
    expect(messages(editVersionSchema, { versionId, label: "v2", changelog: "" })).toEqual([]);
  });

  it("rejects ids that are not uuids with a key the forms can translate", () => {
    for (const message of messages(editVersionSchema, { versionId: "nope", label: "v2", changelog: "" })) {
      expect(VERSION_ERROR_KEYS as readonly string[]).toContain(message);
    }
  });
});
