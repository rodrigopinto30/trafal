import { describe, expect, it } from "vitest";
import { parseDisplayRatio } from "./ratio";

describe("parseDisplayRatio", () => {
  it.each([
    ["16:9", 16, 9],
    ["4:3", 4, 3],
    ["1:1", 1, 1],
    ["9:16", 9, 16],
  ])("lee %s", (value, width, height) => {
    expect(parseDisplayRatio(value)).toEqual({ width, height });
  });

  it.each(["", "16/9", "0:5", "5:0", "abc", "16:9:1", "100:100"])("usa 16:9 si recibe %j", (value) => {
    expect(parseDisplayRatio(value)).toEqual({ width: 16, height: 9 });
  });
});
