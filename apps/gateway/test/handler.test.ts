import { beforeEach, describe, expect, it } from "vitest";
import { createGatewayHandler } from "../src/handler.ts";
import { contentSecurityPolicy } from "../src/headers.ts";
import { FakeDelivery, FakeStorage, makeConfig, request } from "./helpers.ts";

const HOST = "orbita.games.localhost:4000";
const IFRAME = { "sec-fetch-dest": "iframe" };
const HTML = "text/html; charset=utf-8";

let storage: FakeStorage;
let delivery: FakeDelivery;
let handle: (request: Request) => Promise<Response>;

beforeEach(() => {
  storage = new FakeStorage();
  delivery = new FakeDelivery();
  delivery.games.set("orbita", { state: "published", versionNumber: 2, entryPath: "index.html", needsIsolation: false });
  delivery.games.set("viejo", { state: "gone" });
  storage.put("orbita/v2/index.html", "<h1>hola</h1>", HTML);
  storage.put("orbita/v2/game.js", "console.log(1)", "text/javascript; charset=utf-8");
  storage.put("orbita/v2/Build/g.wasm.br", "WASMBYTES", "application/wasm", { contentEncoding: "br" });
  storage.put("orbita/v2/music.ogg", "0123456789", "audio/ogg");
  storage.put("orbita/v2/levels/index.html", "<p>levels</p>", HTML);
  handle = createGatewayHandler({ config: makeConfig(), delivery, storage });
});

async function expectSecure(response: Response): Promise<void> {
  expect(response.headers.get("content-security-policy")).toBe(contentSecurityPolicy(makeConfig()));
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("permissions-policy")).toContain("camera=()");
  expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  expect(response.headers.get("set-cookie")).toBeNull();
}

describe("serving a game", () => {
  it("serves the entry file inside a frame of Trafal", async () => {
    const response = await handle(request(HOST, "/", { headers: IFRAME }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>hola</h1>");
    expect(response.headers.get("content-type")).toBe(HTML);
    await expectSecure(response);
  });

  it("serves assets of the ACTIVE version with their content type, encoding and revalidation", async () => {
    const script = await handle(request(HOST, "/game.js", { headers: { "sec-fetch-dest": "script" } }));
    expect(await script.text()).toBe("console.log(1)");
    expect(script.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(script.headers.get("cache-control")).toBe("no-cache");
    expect(script.headers.get("etag")).toMatch(/^"v2-/);

    const wasm = await handle(request(HOST, "/Build/g.wasm.br", { headers: { "sec-fetch-dest": "empty" } }));
    expect(wasm.headers.get("content-type")).toBe("application/wasm");
    expect(wasm.headers.get("content-encoding")).toBe("br");
    expect(storage.gets).toContain("orbita/v2/Build/g.wasm.br");
  });

  it("serves a folder's index.html", async () => {
    const response = await handle(request(HOST, "/levels/", { headers: IFRAME }));
    expect(await response.text()).toBe("<p>levels</p>");
  });

  it("every response carries the security headers: assets, errors, redirects and method errors", async () => {
    const responses = [
      await handle(request(HOST, "/game.js")),
      await handle(request(HOST, "/missing.js")),
      await handle(request(HOST, "/")),
      await handle(request("viejo.games.localhost", "/")),
      await handle(request("nobody.games.localhost", "/")),
      await handle(request("evil.example.com", "/")),
      await handle(request(HOST, "/game.js", { method: "POST" })),
      await handle(request(HOST, "/%2e%2e/x")),
    ];
    expect(responses.map((response) => response.status)).toEqual([200, 404, 302, 410, 404, 404, 405, 404]);
    for (const response of responses) await expectSecure(response);
  });

  it("serves HEAD without a body", async () => {
    const response = await handle(request(HOST, "/game.js", { method: "HEAD" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("14");
    expect(await response.text()).toBe("");
    expect(storage.gets).toEqual([]);
  });
});

describe("HTML is only for frames of Trafal", () => {
  it.each([["document"], ["frame"], ["embed"], ["object"], ["script"], [""]])("redirects Sec-Fetch-Dest «%s» to the game page on Trafal", async (destination) => {
    const response = await handle(request(HOST, "/", { headers: destination ? { "sec-fetch-dest": destination } : {} }));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3000/games/orbita");
    expect(await response.text()).toBe("");
    expect(storage.gets).toEqual([]);
    await expectSecure(response);
  });

  it("never serves a service worker script, even an existing one", async () => {
    for (const path of ["/", "/game.js"]) {
      const response = await handle(request(HOST, path, { headers: { "sec-fetch-dest": "serviceworker" } }));
      expect(response.status).toBe(403);
      await expectSecure(response);
    }
    expect(storage.gets).toEqual([]);
  });

  it("lets the game's own scripts fetch HTML (destination «empty»)", async () => {
    expect((await handle(request(HOST, "/levels/", { headers: { "sec-fetch-dest": "empty" } }))).status).toBe(200);
  });

  it("applies to any HTML file, not only the entry", async () => {
    expect((await handle(request(HOST, "/levels/index.html", { headers: { "sec-fetch-dest": "document" } }))).status).toBe(302);
  });

  it("does not apply to other types: an image or a script can be requested directly", async () => {
    expect((await handle(request(HOST, "/game.js", { headers: { "sec-fetch-dest": "document" } }))).status).toBe(200);
  });

  it("an SVG or text file named like a page is still just that type", async () => {
    storage.put("orbita/v2/trap.txt", "<script>alert(1)</script>", "text/plain; charset=utf-8");
    const response = await handle(request(HOST, "/trap.txt", { headers: { "sec-fetch-dest": "document" } }));
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("games that are not served", () => {
  it("answers 410 for a hidden or taken down game, and 404 for unknown ones", async () => {
    expect((await handle(request("viejo.games.localhost", "/", { headers: IFRAME }))).status).toBe(410);
    expect((await handle(request("nobody.games.localhost", "/", { headers: IFRAME }))).status).toBe(404);
  });

  it("answers 404 for hosts that are not a game of this domain", async () => {
    for (const host of ["games.localhost", "orbita.games.localhost.evil.com", "localhost:4000", "a.b.games.localhost"]) {
      expect((await handle(request(host, "/", { headers: IFRAME }))).status).toBe(404);
    }
    expect(delivery.lookups).toBe(0);
  });

  it("answers 404 for a missing file and never lists folders", async () => {
    expect((await handle(request(HOST, "/nope.js"))).status).toBe(404);
    expect((await handle(request(HOST, "/Build/"))).status).toBe(404);
  });

  it("never reads outside the version folder, whatever the path", async () => {
    storage.put("orbita/v1/old.js", "old", "text/javascript");
    storage.put("secret.txt", "secret", "text/plain");
    for (const path of ["/%2e%2e/v1/old.js", "/..%2fv1%2fold.js", "/..%5cv1%5cold.js", "/%252e%252e/v1/old.js"]) {
      const response = await handle(request(HOST, path));
      expect(response.status, path).toBe(404);
    }
    expect(storage.gets.every((key) => key.startsWith("orbita/v2/"))).toBe(true);
  });

  it("answers 503 (retry later) when the database cannot be reached, without caching the failure", async () => {
    delivery.failing = true;
    const response = await handle(request(HOST, "/", { headers: IFRAME }));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    await expectSecure(response);
  });

  it("only serves GET and HEAD", async () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS"]) {
      const response = await handle(request(HOST, "/", { method }));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
    }
  });
});

describe("conditional and range requests", () => {
  it("answers 304 when the entity tag still matches, without reading the file", async () => {
    const first = await handle(request(HOST, "/game.js"));
    const etag = first.headers.get("etag") as string;
    storage.gets = [];
    const second = await handle(request(HOST, "/game.js", { headers: { "if-none-match": etag } }));
    expect(second.status).toBe(304);
    expect(storage.gets).toEqual([]);
    await expectSecure(second);
  });

  it("the entity tag changes when the active version changes", async () => {
    const before = (await handle(request(HOST, "/game.js"))).headers.get("etag");
    delivery.games.set("orbita", { state: "published", versionNumber: 3, entryPath: "index.html", needsIsolation: false });
    storage.put("orbita/v3/game.js", "console.log(1)", "text/javascript; charset=utf-8");
    const after = await handle(request(HOST, "/game.js", { headers: { "if-none-match": before as string } }));
    expect(after.status).toBe(200);
  });

  it("serves a byte range with 206 and the right headers", async () => {
    const response = await handle(request(HOST, "/music.ogg", { headers: { range: "bytes=2-5" } }));
    expect(response.status).toBe(206);
    expect(await response.text()).toBe("2345");
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
  });

  it("answers 416 for a range outside the file", async () => {
    const response = await handle(request(HOST, "/music.ogg", { headers: { range: "bytes=50-60" } }));
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });
});

describe("content security policy", () => {
  const policy = contentSecurityPolicy(makeConfig());
  const directive = (name: string) => policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

  it("only lets a game talk to its own origin, with no forms, plugins or nested frames", () => {
    expect(directive("connect-src")).toBe("connect-src 'self' data: blob:");
    expect(directive("form-action")).toBe("form-action 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("frame-src")).toBe("frame-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("img-src")).not.toContain("http");
    expect(directive("media-src")).not.toContain("http");
  });

  it("can only be framed by Trafal", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors http://localhost:3000");
    expect(contentSecurityPolicy(makeConfig({ SITE_URL: "https://trafal.example/x" }))).toContain("frame-ancestors https://trafal.example");
  });

  it("allows what game engines need: inline scripts, eval and WebAssembly", () => {
    expect(directive("script-src")).toContain("'unsafe-eval'");
    expect(directive("script-src")).toContain("'wasm-unsafe-eval'");
    expect(directive("script-src")).toContain("'self'");
  });

  it("limits external code to the CDN allowlist, which can be changed", () => {
    expect(directive("script-src")).toContain("https://cdn.jsdelivr.net");
    expect(directive("script-src")).not.toContain("https://evil.example");
    const custom = contentSecurityPolicy(makeConfig({ GATEWAY_CDN_SCRIPTS: "https://only.example" }));
    expect(custom).toContain("https://only.example");
    expect(custom).not.toContain("cdn.jsdelivr.net/");
  });
});
