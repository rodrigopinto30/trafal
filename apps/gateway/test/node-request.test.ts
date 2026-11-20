import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { toRequest } from "../src/node-request.ts";

const incoming = (url: string, host?: string) => ({ url, method: "GET", headers: host === undefined ? {} : { host } }) as unknown as IncomingMessage;

describe("toRequest", () => {
  it("keeps the host the request names and only the path and query of the request line", () => {
    expect(toRequest(incoming("/levels/1.json?x=1", "orbita.games.localhost:4000"))?.url).toBe("http://orbita.games.localhost:4000/levels/1.json?x=1");
    expect(toRequest(incoming("http://elsewhere.example/index.html", "orbita.games.localhost:4000"))?.url).toBe("http://orbita.games.localhost:4000/index.html");
  });

  it("gives null for what cannot be a request, instead of throwing and taking the server down", () => {
    expect(toRequest(incoming("/", "bad host name"))).toBeNull();
    expect(toRequest(incoming("/", "[::1"))).toBeNull();
  });
});
