import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { EXPLORE_MAX_PAGE, EXPLORE_SORTS, exploreHref, hasFilters, parseExploreQuery } from "./explore";

describe("parseExploreQuery", () => {
  it("defaults to the newest games, from the first page", () => {
    expect(parseExploreQuery({})).toEqual({ q: null, genre: null, engine: null, mobile: false, sort: "recent", page: 1 });
  });

  it("keeps what is valid", () => {
    expect(parseExploreQuery({ q: "  orbita ", genre: "puzzle", engine: "godot", mobile: "1", sort: "trending", page: "3" })).toEqual({
      q: "orbita",
      genre: "puzzle",
      engine: "godot",
      mobile: true,
      sort: "trending",
      page: 3,
    });
  });

  it("searching sorts by relevance unless another order is chosen, and relevance needs a text", () => {
    expect(parseExploreQuery({ q: "faro" }).sort).toBe("relevance");
    expect(parseExploreQuery({ q: "faro", sort: "plays" }).sort).toBe("plays");
    expect(parseExploreQuery({ sort: "relevance" }).sort).toBe("recent");
  });

  it.each([
    [{ genre: "terror2" }],
    [{ genre: "PUZZLE" }],
    [{ genre: "puzzle' or '1'='1" }],
    [{ engine: "flash" }],
    [{ mobile: "yes" }],
    [{ mobile: "true" }],
    [{ sort: "random" }],
    [{ page: "0" }],
    [{ page: "-4" }],
    [{ page: "2.5" }],
    [{ page: "abc" }],
    [{ page: String(EXPLORE_MAX_PAGE + 1) }],
  ])("ignores %j", (raw) => {
    expect(parseExploreQuery(raw)).toEqual({ q: null, genre: null, engine: null, mobile: false, sort: "recent", page: 1 });
  });

  it("cleans the text like the search box does", () => {
    expect(parseExploreQuery({ q: "a\u202Eb\u0000c   d" }).q).toBe("ab c d");
    expect(parseExploreQuery({ q: "x".repeat(200) }).q).toHaveLength(80);
  });
});

describe("exploreHref", () => {
  it("leaves out the defaults", () => {
    expect(exploreHref(parseExploreQuery({}))).toBe("/explore");
    expect(exploreHref(parseExploreQuery({ q: "faro" }))).toBe("/explore?q=faro");
    expect(exploreHref(parseExploreQuery({ genre: "puzzle", mobile: "1", sort: "plays", page: "2" }))).toBe("/explore?genre=puzzle&mobile=1&sort=plays&page=2");
  });

  it("can drop the text and the page, to change the search but keep the filters", () => {
    const query = parseExploreQuery({ q: "faro", genre: "puzzle", sort: "plays", page: "4" });
    expect(exploreHref(query, ["q", "page"])).toBe("/explore?genre=puzzle&sort=plays");
  });

  it("round-trips through the parser", () => {
    const query = parseExploreQuery({ q: "caja de música", genre: "puzzle", engine: "phaser", mobile: "1", sort: "trending", page: "2" });
    const url = new URL(exploreHref(query), "http://localhost");
    expect(parseExploreQuery(Object.fromEntries(url.searchParams))).toEqual(query);
  });
});

describe("hasFilters", () => {
  it("the text and the order do not count as filters", () => {
    expect(hasFilters(parseExploreQuery({ q: "faro", sort: "plays" }))).toBe(false);
    expect(hasFilters(parseExploreQuery({ genre: "puzzle" }))).toBe(true);
    expect(hasFilters(parseExploreQuery({ mobile: "1" }))).toBe(true);
  });
});

describe.each([
  ["es", es.explore],
  ["en", en.explore],
])("explore messages (%s)", (_language, messages) => {
  it("names every order", () => {
    expect(Object.keys(messages.sorts).sort()).toEqual([...EXPLORE_SORTS].sort());
  });
});
