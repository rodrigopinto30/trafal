import { describe, expect, it } from "vitest";
import { ConfigError, loadGatewayConfig } from "../src/config.ts";
import { publicIdFromHost } from "../src/host.ts";
import { resolveObjectPath } from "../src/path.ts";
import { BASE_ENV, makeConfig } from "./helpers.ts";

describe("publicIdFromHost", () => {
  it.each([
    ["orbita.games.localhost:4000", "orbita"],
    ["ORBITA.Games.Localhost", "orbita"],
    ["gato-laser.games.localhost", "gato-laser"],
    ["hsnf9dggfph5.games.localhost:4000", "hsnf9dggfph5"],
  ])("extracts the game id from %s", (host, expected) => {
    expect(publicIdFromHost(host, "games.localhost")).toBe(expected);
  });

  it.each([
    null,
    "",
    "games.localhost",
    "games.localhost:4000",
    "localhost:4000",
    "a.b.games.localhost",
    "-bad.games.localhost",
    "bad-.games.localhost",
    "ba_d.games.localhost",
    "orbita.games.localhost.evil.com",
    "orbita.evil.com",
    "evilgames.localhost",
    `${"a".repeat(41)}.games.localhost`,
  ])("rejects %s", (host) => {
    expect(publicIdFromHost(host, "games.localhost")).toBeNull();
  });
});

describe("resolveObjectPath", () => {
  it("serves the entry file for the root", () => {
    expect(resolveObjectPath("/", "index.html")).toBe("index.html");
    expect(resolveObjectPath("/", "game/start.html")).toBe("game/start.html");
  });

  it("maps files and folders", () => {
    expect(resolveObjectPath("/game.js", "index.html")).toBe("game.js");
    expect(resolveObjectPath("/Build/game.wasm.br", "index.html")).toBe("Build/game.wasm.br");
    expect(resolveObjectPath("/levels/", "index.html")).toBe("levels/index.html");
    expect(resolveObjectPath("/sonidos/m%C3%BAsica%20%C3%B1and%C3%BA.ogg", "index.html")).toBe("sonidos/música ñandú.ogg");
  });

  it.each([
    "/%2e%2e/secret",
    "/a/%2E%2E/b",
    "/a%2f..%2fb",
    "/a%5cb",
    "/a\\b",
    "/a%00b",
    "/a%0ab",
    "/%2e/x",
    "//double",
    "/a//b",
    "/%E0%A4%A",
    `/${"a".repeat(401)}`,
    "no-leading-slash",
  ])("rejects %s", (path) => {
    expect(resolveObjectPath(path, "index.html")).toBeNull();
  });
});

describe("loadGatewayConfig", () => {
  it("derives the domain and the site origin", () => {
    const config = makeConfig();
    expect(config.gamesDomain).toBe("games.localhost");
    expect(config.siteOrigin).toBe("http://localhost:3000");
    expect(config.s3.bucket).toBe("games");
    expect(config.deliveryCacheSeconds).toBe(10);
  });

  it("lists everything that is missing", () => {
    expect(() => loadGatewayConfig({})).toThrow(ConfigError);
    expect(() => loadGatewayConfig({ ...BASE_ENV, S3_ENDPOINT: "", SITE_URL: "" })).toThrow(/S3_ENDPOINT/);
  });

  it("drops the path of SITE_URL when building the framing origin", () => {
    expect(makeConfig({ SITE_URL: "https://trafal.example/some/path?x=1" }).siteOrigin).toBe("https://trafal.example");
  });
});
