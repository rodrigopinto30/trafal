import { describe, expect, it } from "vitest";
import { gameDetailsSchema, zipDeclarationSchema } from "./game";

const valid = {
  title: "  Moon   Runner ",
  shortDescription: "Run on the moon",
  genre: "platformer",
  engine: "godot",
  tags: "Pixel Art, RETRO, retro,  ",
  controls: "Arrows to move\n\n\n\nSpace to jump",
  displayRatio: "16:9",
  worksOnMobile: false,
  isFirstGame: true,
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

  it("only accepts known genres and engines", () => {
    expect(issues({ genre: "nope" })).toEqual(["invalidGenre"]);
    expect(issues({ genre: "" })).toEqual(["invalidGenre"]);
    expect(issues({ engine: "unreal" })).toEqual(["invalidEngine"]);
  });

  it("limits tags to 8 of up to 24 characters", () => {
    expect(issues({ tags: "a,b,c,d,e,f,g,h,i" })).toEqual(["tooManyTags"]);
    expect(issues({ tags: "a,b,c,d,e,f,g,h" })).toEqual([]);
    expect(issues({ tags: "x".repeat(25) })).toEqual(["tagTooLong"]);
  });

  it("limits how-to-play to 500 characters", () => {
    expect(issues({ controls: "a".repeat(501) })).toEqual(["controlsTooLong"]);
  });

  it("only accepts the four display ratios", () => {
    expect(issues({ displayRatio: "21:9" })).toEqual(["invalidRatio"]);
    expect(issues({ displayRatio: "9:16" })).toEqual([]);
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
