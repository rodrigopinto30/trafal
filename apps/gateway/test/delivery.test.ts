import { describe, expect, it } from "vitest";
import { CachedDeliveryLookup, DeliveryUnavailable, SupabaseDeliveryLookup, type Delivery, type DeliveryLookup } from "../src/delivery.ts";

class Counting implements DeliveryLookup {
  calls = 0;
  value: Delivery | null = { state: "published", versionNumber: 1, entryPath: "index.html", needsIsolation: false };
  async find(): Promise<Delivery | null> {
    this.calls += 1;
    return this.value;
  }
}

describe("CachedDeliveryLookup", () => {
  it("asks once per game while the answer is fresh, and again after it expires", async () => {
    let now = 0;
    const inner = new Counting();
    const cached = new CachedDeliveryLookup(inner, 10, () => now);
    await cached.find("orbita");
    await cached.find("orbita");
    await cached.find("other");
    expect(inner.calls).toBe(2);
    now = 9_999;
    await cached.find("orbita");
    expect(inner.calls).toBe(2);
    now = 10_001;
    await cached.find("orbita");
    expect(inner.calls).toBe(3);
  });

  it("a game that gets hidden is gone as soon as the cached answer expires", async () => {
    let now = 0;
    const inner = new Counting();
    const cached = new CachedDeliveryLookup(inner, 10, () => now);
    expect((await cached.find("orbita"))?.state).toBe("published");
    inner.value = { state: "gone" };
    now = 10_001;
    expect((await cached.find("orbita"))?.state).toBe("gone");
  });

  it("remembers «not found» for a shorter time", async () => {
    let now = 0;
    const inner = new Counting();
    inner.value = null;
    const cached = new CachedDeliveryLookup(inner, 60, () => now);
    await cached.find("nobody");
    now = 4_000;
    await cached.find("nobody");
    expect(inner.calls).toBe(1);
    now = 5_001;
    await cached.find("nobody");
    expect(inner.calls).toBe(2);
  });

  it("never caches a failure", async () => {
    let failing = true;
    const inner: DeliveryLookup = {
      async find() {
        if (failing) throw new DeliveryUnavailable("down");
        return { state: "gone" };
      },
    };
    const cached = new CachedDeliveryLookup(inner, 10);
    await expect(cached.find("orbita")).rejects.toThrow(DeliveryUnavailable);
    failing = false;
    expect((await cached.find("orbita"))?.state).toBe("gone");
  });
});

function fakeFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) => Promise.resolve(handler(String(url), init ?? {}))) as typeof fetch;
}

describe("SupabaseDeliveryLookup", () => {
  const rows = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it("calls the game_delivery function with the publishable key and the id", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const lookup = new SupabaseDeliveryLookup("http://db:8000", "public-key", fakeFetch((url, init) => {
      seen = { url, init };
      return rows([{ state: "published", version_number: 3, needs_isolation: true, entry_path: "game/start.html" }]);
    }));
    expect(await lookup.find("orbita")).toEqual({ state: "published", versionNumber: 3, entryPath: "game/start.html", needsIsolation: true });
    expect(seen?.url).toBe("http://db:8000/rest/v1/rpc/game_delivery");
    expect((seen?.init.headers as Record<string, string>).apikey).toBe("public-key");
    expect(JSON.parse(seen?.init.body as string)).toEqual({ p_public_id: "orbita" });
  });

  it("understands gone games, unknown games and missing entry paths", async () => {
    const answer = (body: unknown) => new SupabaseDeliveryLookup("http://db", "k", fakeFetch(() => rows(body)));
    expect(await answer([{ state: "gone", version_number: null, needs_isolation: null, entry_path: null }]).find("x")).toEqual({ state: "gone" });
    expect(await answer([]).find("x")).toBeNull();
    expect(await answer([{ state: "published", version_number: 1, needs_isolation: false, entry_path: null }]).find("x")).toEqual({
      state: "published",
      versionNumber: 1,
      entryPath: "index.html",
      needsIsolation: false,
    });
    expect(await answer([{ state: "published", version_number: null, needs_isolation: false, entry_path: "i.html" }]).find("x")).toBeNull();
    expect(await answer([{ state: "something-else", version_number: 1, needs_isolation: false, entry_path: "i.html" }]).find("x")).toBeNull();
  });

  it("reports the database as unavailable on errors and network failures", async () => {
    await expect(new SupabaseDeliveryLookup("http://db", "k", fakeFetch(() => new Response("boom", { status: 500 }))).find("x")).rejects.toThrow(DeliveryUnavailable);
    const broken = fakeFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(new SupabaseDeliveryLookup("http://db", "k", broken).find("x")).rejects.toThrow(DeliveryUnavailable);
  });
});
