import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { FEED_KINDS, FEED_SCOPES, feedHref, parseFeedQuery } from "./feed";

describe("parseFeedQuery", () => {
  it("defaults to everything from everyone, from the start", () => {
    expect(parseFeedQuery({})).toEqual({ kind: "all", scope: "all", before: null });
  });

  it("keeps the known kinds, scopes and a valid cursor", () => {
    expect(parseFeedQuery({ kind: "hito", scope: "following", before: "2026-11-07T10:00:00.000Z" })).toEqual({
      kind: "hito",
      scope: "following",
      before: "2026-11-07T10:00:00.000Z",
    });
    expect(parseFeedQuery({ before: "2026-11-07T10:00:00+00:00" }).before).toBe("2026-11-07T10:00:00+00:00");
  });

  it.each([
    [{ kind: "spam" }],
    [{ kind: "HITO" }],
    [{ kind: "avance; drop table posts" }],
    [{ scope: "everyone" }],
    [{ before: "yesterday" }],
    [{ before: "2026-11-07" }],
    [{ before: "' or 1=1 --" }],
  ])("ignores %j and falls back to the default", (raw) => {
    expect(parseFeedQuery(raw)).toEqual({ kind: "all", scope: "all", before: null });
  });
});

describe("feedHref", () => {
  it("leaves out the defaults", () => {
    expect(feedHref({ kind: "all", scope: "all", before: null })).toBe("/feed");
    expect(feedHref({ kind: "hito", scope: "all", before: null })).toBe("/feed?kind=hito");
    expect(feedHref({ kind: "all", scope: "following", before: "2026-11-07T10:00:00.000Z" })).toBe("/feed?scope=following&before=2026-11-07T10%3A00%3A00.000Z");
  });

  it("round-trips through the parser", () => {
    const query = { kind: "pide_feedback", scope: "following", before: "2026-11-07T10:00:00.000Z" } as const;
    const url = new URL(feedHref(query), "http://localhost");
    expect(parseFeedQuery(Object.fromEntries(url.searchParams))).toEqual(query);
  });
});

describe.each([
  ["es", es.feed],
  ["en", en.feed],
])("feed messages (%s)", (_language, messages) => {
  it("names every kind and every scope", () => {
    expect(Object.keys(messages.kinds).sort()).toEqual([...FEED_KINDS].sort());
    expect(Object.keys(messages.scopes).sort()).toEqual([...FEED_SCOPES].sort());
  });
});
