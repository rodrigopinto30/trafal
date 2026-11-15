import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";
import { BRIDGE_SCRIPT, BRIDGE_VERSION, findInsertionPoint, injectBridge } from "../src/bridge.ts";
import { createGatewayHandler } from "../src/handler.ts";
import { FakeDelivery, FakeStorage, makeConfig, request } from "./helpers.ts";

const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text);

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function run(chunks: string[] | Uint8Array[]): Promise<string> {
  const parts = chunks.map((chunk) => (typeof chunk === "string" ? bytes(chunk) : chunk));
  return new Response(injectBridge(streamOf(parts))).text();
}

const BRIDGED = (text: string) => text.includes("data-trafal-bridge");
const before = (text: string, marker: string) => text.indexOf("data-trafal-bridge") < text.indexOf(marker);

describe("where the bridge goes", () => {
  it("right after <head> when there is nothing declared before the end of the head", async () => {
    const out = await run(['<!doctype html><html><head><title>x</title></head><body>hola</body></html>']);
    expect(out.indexOf("<head>") + 6).toBe(out.indexOf("<script data-trafal-bridge"));
    expect(out.endsWith("<title>x</title></head><body>hola</body></html>")).toBe(true);
  });

  it("after the charset declaration, so it still counts as one of the first bytes of the page", async () => {
    const page = '<!doctype html><html><head><meta charset="utf-8"><title>ñ</title></head><body></body></html>';
    const out = await run([page]);
    expect(out.indexOf('<meta charset="utf-8">') + '<meta charset="utf-8">'.length).toBe(out.indexOf("<script data-trafal-bridge"));
    expect(before(out, "<title>")).toBe(true);
  });

  it("after a content-type http-equiv too, and ignores charsets that only appear in the body", async () => {
    const out = await run(['<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"></head><body><meta charset="x"></body></html>']);
    expect(out.indexOf('charset=iso-8859-1">') + 'charset=iso-8859-1">'.length).toBe(out.indexOf("<script data-trafal-bridge"));
  });

  it("does not take <header> for <head> and ignores tags inside comments", async () => {
    const out = await run(["<!doctype html><!-- <head><meta charset=x> --><html><body><header>h</header></body></html>"]);
    expect(out.indexOf("<html>") + 6).toBe(out.indexOf("<script data-trafal-bridge"));
    expect(before(out, "<header>")).toBe(true);
  });

  it("after the doctype or <html> when there is no head, and at the very start for a bare fragment", async () => {
    expect(await run(["<!DOCTYPE html><canvas id=c></canvas>"])).toMatch(/^<!DOCTYPE html><script data-trafal-bridge/);
    expect(await run(['<html lang="es"><canvas></canvas>'])).toMatch(/^<html lang="es"><script data-trafal-bridge/);
    expect(await run(["<h1>hola</h1>"])).toMatch(/^<script data-trafal-bridge.*<\/script><h1>hola<\/h1>$/s);
  });

  it("keeps a byte order mark first", async () => {
    const out = new Uint8Array(await new Response(injectBridge(streamOf([new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("<p>x</p>")])]))).arrayBuffer());
    expect([...out.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(out.subarray(3, 30))).toBe("<script data-trafal-bridge>");
  });

  it("finds the point when the page arrives in tiny pieces, even in the middle of a tag", async () => {
    const page = '<!doctype html><html><head><meta charset="utf-8"><title>x</title></head><body></body></html>';
    const pieces = page.match(/.{1,7}/g) as string[];
    const out = await run(pieces);
    expect(out.replace(/<script data-trafal-bridge>[\s\S]*?<\/script>/, "")).toBe(page);
    expect(out.indexOf('<meta charset="utf-8">') + '<meta charset="utf-8">'.length).toBe(out.indexOf("<script data-trafal-bridge"));
  });

  it("leaves UTF-16 pages alone and passes everything after the point through untouched", async () => {
    const utf16 = new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x68, 0x00]);
    expect(findInsertionPoint(utf16, true)).toBeNull();
    const big = "x".repeat(200_000);
    const out = await run([`<html><head></head><body>${big}</body></html>`]);
    expect(out.endsWith(`</head><body>${big}</body></html>`)).toBe(true);
    expect(BRIDGED(out)).toBe(true);
  });

  it("is not added twice by the page itself and streams errors through", async () => {
    const failing = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes("<html><head>"));
        controller.error(new Error("storage hiccup"));
      },
    });
    await expect(new Response(injectBridge(failing)).text()).rejects.toThrow("storage hiccup");
  });
});

describe("what the gateway does with it", () => {
  const HOST = "orbita.games.localhost:4000";
  const HTML = "text/html; charset=utf-8";
  let storage: FakeStorage;
  let handle: (request: Request) => Promise<Response>;

  beforeEach(() => {
    storage = new FakeStorage();
    const delivery = new FakeDelivery();
    delivery.games.set("orbita", { state: "published", versionNumber: 2, entryPath: "index.html", needsIsolation: false });
    storage.put("orbita/v2/index.html", "<!doctype html><html><head><title>x</title></head><body>hola</body></html>", HTML);
    storage.put("orbita/v2/data.html", "<p>datos</p>", HTML);
    storage.put("orbita/v2/pre.html", "<p>comprimido</p>", HTML, { contentEncoding: "gzip" });
    storage.put("orbita/v2/game.js", "console.log(1)", "text/javascript");
    handle = createGatewayHandler({ config: makeConfig(), delivery, storage });
  });

  it("adds it to HTML inside a frame, without a length and without ranges", async () => {
    const response = await handle(request(HOST, "/", { headers: { "sec-fetch-dest": "iframe" } }));
    expect(BRIDGED(await response.text())).toBe(true);
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("accept-ranges")).toBe("none");
    expect(response.headers.get("content-type")).toBe(HTML);
  });

  it("does not touch the game's own fetches, ranges, encoded files or anything that is not HTML", async () => {
    const fetched = await handle(request(HOST, "/data.html", { headers: { "sec-fetch-dest": "empty" } }));
    expect(BRIDGED(await fetched.text())).toBe(false);
    const ranged = await handle(request(HOST, "/", { headers: { "sec-fetch-dest": "iframe", range: "bytes=0-9" } }));
    expect(ranged.status).toBe(206);
    expect(BRIDGED(await ranged.text())).toBe(false);
    const encoded = await handle(request(HOST, "/pre.html", { headers: { "sec-fetch-dest": "iframe" } }));
    expect(BRIDGED(await encoded.text())).toBe(false);
    const script = await handle(request(HOST, "/game.js", { headers: { "sec-fetch-dest": "iframe" } }));
    expect(BRIDGED(await script.text())).toBe(false);
    expect(script.headers.get("content-length")).toBe("14");
  });

  it("changes the entity tag of the pages that carry it, and 304 still works", async () => {
    const framed = await handle(request(HOST, "/", { headers: { "sec-fetch-dest": "iframe" } }));
    const tag = framed.headers.get("etag") ?? "";
    expect(tag).toMatch(new RegExp(`-b${BRIDGE_VERSION}"$`));
    const plain = await handle(request(HOST, "/data.html", { headers: { "sec-fetch-dest": "empty" } }));
    expect(plain.headers.get("etag")).not.toMatch(/-b\d+"$/);
    const again = await handle(request(HOST, "/", { headers: { "sec-fetch-dest": "iframe", "if-none-match": tag } }));
    expect(again.status).toBe(304);
  });

  it("answers HEAD for a page with the tag and no length", async () => {
    const response = await handle(request(HOST, "/", { method: "HEAD", headers: { "sec-fetch-dest": "iframe" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toMatch(/-b\d+"$/);
    expect(response.headers.get("content-length")).toBeNull();
  });
});

type Listener = (event: { source: unknown; data: unknown }) => void;

function sandbox() {
  const listeners: Listener[] = [];
  const posted: unknown[] = [];
  const parent = { postMessage: (message: unknown) => posted.push(message) };
  const gains: Array<{ value: number; target: number | null; context: unknown }> = [];
  const connections: Array<[unknown, unknown]> = [];

  class FakeNode {
    connect(target: unknown) {
      connections.push([this, target]);
      return target;
    }
    disconnect() {}
  }
  class FakeDestination extends FakeNode {
    context: unknown;
    constructor(context: unknown) {
      super();
      this.context = context;
    }
  }
  class FakeContext {
    destination = new FakeDestination(this);
    currentTime = 1;
    createGain() {
      const node = new FakeNode() as FakeNode & { gain: unknown; context: unknown };
      const state = { value: 1, target: null as number | null, context: this };
      gains.push(state);
      node.context = this;
      node.gain = {
        get value() {
          return state.value;
        },
        set value(next: number) {
          state.value = next;
        },
        cancelScheduledValues() {},
        setTargetAtTime(target: number) {
          state.target = target;
        },
      };
      return node;
    }
  }
  class FakeOffline extends FakeContext {}
  const mutedValues = new WeakMap<object, boolean>();
  class FakeMedia {
    played = 0;
    play() {
      this.played += 1;
    }
    get muted() {
      return mutedValues.get(this) ?? false;
    }
    set muted(value: boolean) {
      mutedValues.set(this, value);
    }
  }
  const media = [new FakeMedia(), new FakeMedia()];
  const window: Record<string, unknown> = {
    AudioNode: FakeNode,
    AudioDestinationNode: FakeDestination,
    OfflineAudioContext: FakeOffline,
    HTMLMediaElement: FakeMedia,
    WeakMap,
    parent,
    document: { querySelectorAll: () => media },
    addEventListener: (type: string, listener: Listener) => {
      if (type === "message") listeners.push(listener);
    },
  };
  window.window = window;
  return { window, listeners, posted, parent, gains, connections, FakeContext, FakeOffline, FakeNode, media, mutedValues };
}

describe("the bridge script", () => {
  it("announces itself to the parent window and only once", () => {
    const env = sandbox();
    runInNewContext(BRIDGE_SCRIPT, env.window);
    runInNewContext(BRIDGE_SCRIPT, env.window);
    expect(env.posted).toEqual([{ trafal: 1, type: "ready" }]);
  });

  it("routes what a game connects to the speakers through one gain per context and mutes it on request", () => {
    const env = sandbox();
    runInNewContext(BRIDGE_SCRIPT, env.window);
    const context = new env.FakeContext();
    const source = new env.FakeNode();
    const returned = source.connect(context.destination);
    expect(returned).toBe(context.destination);
    source.connect(context.destination);
    expect(env.gains).toHaveLength(1);
    const [, wired] = env.connections.find(([from]) => from === source) ?? [];
    expect(wired).not.toBe(context.destination);

    for (const listener of env.listeners) listener({ source: env.parent, data: { trafal: 1, type: "mute", muted: true } });
    expect(env.gains[0]?.target).toBe(0);
    for (const listener of env.listeners) listener({ source: env.parent, data: { trafal: 1, type: "mute", muted: false } });
    expect(env.gains[0]?.target).toBe(1);
  });

  it("starts silent for contexts created while muted and leaves offline rendering alone", () => {
    const env = sandbox();
    runInNewContext(BRIDGE_SCRIPT, env.window);
    for (const listener of env.listeners) listener({ source: env.parent, data: { trafal: 1, type: "mute", muted: true } });
    const live = new env.FakeContext();
    new env.FakeNode().connect(live.destination);
    expect(env.gains[0]?.value).toBe(0);
    const offline = new env.FakeOffline();
    const source = new env.FakeNode();
    source.connect(offline.destination);
    expect(env.connections.some(([from, to]) => from === source && to === offline.destination)).toBe(true);
  });

  it("mutes media elements and gives them back exactly what the game asked for", () => {
    const env = sandbox();
    runInNewContext(BRIDGE_SCRIPT, env.window);
    const [first, second] = env.media as unknown as Array<{ muted: boolean; play(): void }>;
    if (!first || !second) throw new Error("fixture");
    second.muted = true;
    for (const listener of env.listeners) listener({ source: env.parent, data: { trafal: 1, type: "mute", muted: true } });
    expect(env.mutedValues.get(first as object)).toBe(true);
    expect(first.muted).toBe(false);
    first.play();
    expect(env.mutedValues.get(first as object)).toBe(true);
    first.muted = false;
    expect(env.mutedValues.get(first as object)).toBe(true);
    for (const listener of env.listeners) listener({ source: env.parent, data: { trafal: 1, type: "mute", muted: false } });
    expect(env.mutedValues.get(first as object)).toBe(false);
    expect(env.mutedValues.get(second as object)).toBe(true);
  });

  it("ignores messages that do not come from the parent window or are not for it", () => {
    const env = sandbox();
    runInNewContext(BRIDGE_SCRIPT, env.window);
    const context = new env.FakeContext();
    new env.FakeNode().connect(context.destination);
    for (const message of [{ source: {}, data: { trafal: 1, type: "mute", muted: true } }, { source: env.parent, data: { type: "mute", muted: true } }, { source: env.parent, data: null }, { source: env.parent, data: { trafal: 1, type: "mute", muted: "yes" } }]) {
      for (const listener of env.listeners) listener(message);
    }
    expect(env.gains[0]?.target ?? 1).toBe(1);
    for (const listener of env.listeners) listener({ source: env.parent, data: { trafal: 1, type: "hello" } });
    expect(env.posted).toHaveLength(2);
  });
});
