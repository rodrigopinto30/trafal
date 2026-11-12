import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { CREATORS_MAX_PAGE, CREATORS_SORTS, creatorsHref, hasCreatorFilters, parseCreatorsQuery } from "./creators";

describe("parseCreatorsQuery", () => {
  it("defaults to the newest members, from the first page", () => {
    expect(parseCreatorsQuery({})).toEqual({ q: null, genre: null, sort: "newest", page: 1 });
  });

  it("keeps what is valid", () => {
    expect(parseCreatorsQuery({ q: " sofi ", genre: "puzzle", sort: "followers", page: "2" })).toEqual({
      q: "sofi",
      genre: "puzzle",
      sort: "followers",
      page: 2,
    });
  });

  it.each([
    [{ genre: "terror2" }],
    [{ genre: "puzzle' or '1'='1" }],
    [{ sort: "random" }],
    [{ sort: "relevance" }],
    [{ page: "0" }],
    [{ page: "-1" }],
    [{ page: "1.5" }],
    [{ page: "abc" }],
    [{ page: String(CREATORS_MAX_PAGE + 1) }],
  ])("ignores %j", (raw) => {
    expect(parseCreatorsQuery(raw)).toEqual({ q: null, genre: null, sort: "newest", page: 1 });
  });
});

describe("creatorsHref", () => {
  it("leaves out the defaults", () => {
    expect(creatorsHref(parseCreatorsQuery({}))).toBe("/creators");
    expect(creatorsHref(parseCreatorsQuery({ q: "sofi" }))).toBe("/creators?q=sofi");
    expect(creatorsHref(parseCreatorsQuery({ genre: "cozy", sort: "games", page: "3" }))).toBe("/creators?genre=cozy&sort=games&page=3");
  });

  it("round-trips through the parser", () => {
    const query = parseCreatorsQuery({ q: "ana gómez", genre: "puzzle", sort: "followers", page: "2" });
    const url = new URL(creatorsHref(query), "http://localhost");
    expect(parseCreatorsQuery(Object.fromEntries(url.searchParams))).toEqual(query);
  });
});

describe("hasCreatorFilters", () => {
  it("the text and the order do not count as filters", () => {
    expect(hasCreatorFilters(parseCreatorsQuery({ q: "x", sort: "games" }))).toBe(false);
    expect(hasCreatorFilters(parseCreatorsQuery({ genre: "cozy" }))).toBe(true);
  });
});

describe.each([
  ["es", es.creators],
  ["en", en.creators],
])("creators messages (%s)", (_language, messages) => {
  it("names every order", () => {
    expect(Object.keys(messages.sorts).sort()).toEqual([...CREATORS_SORTS].sort());
  });
});
