import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { EXPLORE_MAX_PAGE, EXPLORE_PARAMS, EXPLORE_SORTS, exploreHref, hasFilters, isExploring, parseExploreQuery } from "./explore";

describe("parseExploreQuery", () => {
  it("defaults to the newest games, from the first page", () => {
    expect(parseExploreQuery({})).toEqual({ q: null, genre: null, sort: "recent", page: 1 });
  });

  it("keeps what is valid", () => {
    expect(parseExploreQuery({ q: "  orbita ", genre: "puzzle", sort: "trending", page: "3" })).toEqual({
      q: "orbita",
      genre: "puzzle",
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
    [{ sort: "random" }],
    [{ page: "0" }],
    [{ page: "-4" }],
    [{ page: "2.5" }],
    [{ page: "abc" }],
    [{ page: String(EXPLORE_MAX_PAGE + 1) }],
  ])("ignores %j", (raw) => {
    expect(parseExploreQuery(raw)).toEqual({ q: null, genre: null, sort: "recent", page: 1 });
  });

  it("cleans the text like the search box does", () => {
    expect(parseExploreQuery({ q: "a\u202Eb\u0000c   d" }).q).toBe("ab c d");
    expect(parseExploreQuery({ q: "x".repeat(200) }).q).toHaveLength(80);
  });
});

describe("isExploring", () => {
  it("is false for the plain home, whatever the unrelated parameters", () => {
    expect(isExploring(parseExploreQuery({}))).toBe(false);
    expect(isExploring(parseExploreQuery({ sort: "recent" }))).toBe(false);
    expect(isExploring(parseExploreQuery({ q: "   ", genre: "nope", page: "1" }))).toBe(false);
  });

  it("is true for a search, a filter, another order or a later page", () => {
    for (const raw of [{ q: "faro" }, { genre: "puzzle" }, { sort: "plays" }, { page: "2" }]) {
      expect(isExploring(parseExploreQuery(raw)), JSON.stringify(raw)).toBe(true);
    }
  });

  it("knows the parameters that make the home a search view", () => {
    expect([...EXPLORE_PARAMS].sort()).toEqual(["genre", "page", "q", "sort"]);
  });
});

describe("exploreHref", () => {
  it("leaves out the defaults", () => {
    expect(exploreHref(parseExploreQuery({}))).toBe("/");
    expect(exploreHref(parseExploreQuery({ q: "faro" }))).toBe("/?q=faro");
    expect(exploreHref(parseExploreQuery({ genre: "puzzle", sort: "plays", page: "2" }))).toBe("/?genre=puzzle&sort=plays&page=2");
  });

  it("can drop the text and the page, to change the search but keep the filters", () => {
    const query = parseExploreQuery({ q: "faro", genre: "puzzle", sort: "plays", page: "4" });
    expect(exploreHref(query, ["q", "page"])).toBe("/?genre=puzzle&sort=plays");
  });

  it("round-trips through the parser", () => {
    const query = parseExploreQuery({ q: "caja de música", genre: "puzzle", sort: "trending", page: "2" });
    const url = new URL(exploreHref(query), "http://localhost");
    expect(parseExploreQuery(Object.fromEntries(url.searchParams))).toEqual(query);
  });
});

describe("hasFilters", () => {
  it("the text and the order do not count as filters", () => {
    expect(hasFilters(parseExploreQuery({ q: "faro", sort: "plays" }))).toBe(false);
    expect(hasFilters(parseExploreQuery({ genre: "puzzle" }))).toBe(true);
    expect(hasFilters(parseExploreQuery({ genre: "puzzle" }))).toBe(true);
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
