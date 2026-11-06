import { describe, expect, it } from "vitest";
import { classifyDevice } from "./device";
import { gameFrameUrl } from "./frame-url";

describe("gameFrameUrl", () => {
  it("puts the game id as a subdomain of the games domain, keeping scheme and port", () => {
    expect(gameFrameUrl("http://games.localhost:4000", "orbita")).toBe("http://orbita.games.localhost:4000/");
    expect(gameFrameUrl("https://trafal-games.example", "hsnf9dggfph5")).toBe("https://hsnf9dggfph5.trafal-games.example/");
    expect(gameFrameUrl("https://trafal-games.example/ignored/path?x=1", "gato-laser")).toBe("https://gato-laser.trafal-games.example/");
  });

  it("returns null when the games domain is missing or not an http(s) address", () => {
    for (const base of ["", "games.localhost", "javascript:alert(1)", "ftp://games.example", "not a url"]) {
      expect(gameFrameUrl(base, "orbita")).toBeNull();
    }
  });

  it("returns null for ids that could build another host", () => {
    for (const id of ["", "Orbita", "a.b", "a/b", "a@evil.com", "a b", "-a", "a-", "a_b", "a".repeat(41), "../x"]) {
      expect(gameFrameUrl("http://games.localhost:4000", id)).toBeNull();
    }
  });
});

describe("classifyDevice", () => {
  it("is desktop whenever the pointer is precise, whatever the window width", () => {
    expect(classifyDevice({ innerWidth: 360, coarsePointer: false })).toBe("desktop");
    expect(classifyDevice({ innerWidth: 1920, coarsePointer: false })).toBe("desktop");
  });

  it("splits touch devices by width", () => {
    expect(classifyDevice({ innerWidth: 360, coarsePointer: true })).toBe("mobile");
    expect(classifyDevice({ innerWidth: 767, coarsePointer: true })).toBe("mobile");
    expect(classifyDevice({ innerWidth: 768, coarsePointer: true })).toBe("tablet");
    expect(classifyDevice({ innerWidth: 1280, coarsePointer: true })).toBe("tablet");
  });
});
