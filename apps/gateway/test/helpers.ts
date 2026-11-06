import { loadGatewayConfig, type GatewayConfig } from "../src/config.ts";
import type { Delivery, DeliveryLookup } from "../src/delivery.ts";
import type { GameStorage, ObjectBody, ObjectMeta, RangeNotSatisfiable } from "../src/storage.ts";

export const BASE_ENV = {
  GAMES_BASE_URL: "http://games.localhost:4000",
  SITE_URL: "http://localhost:3000",
  SUPABASE_URL: "http://db:8000",
  SUPABASE_PUBLISHABLE_KEY: "public-key",
  S3_ENDPOINT: "http://s3",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
};

export function makeConfig(overrides: Record<string, string> = {}): GatewayConfig {
  return loadGatewayConfig({ ...BASE_ENV, ...overrides });
}

type StoredFile = { data: string; contentType: string; contentEncoding?: string; etag?: string };

export class FakeStorage implements GameStorage {
  files = new Map<string, StoredFile>();
  gets: string[] = [];
  heads: string[] = [];

  put(key: string, data: string, contentType: string, extra: Partial<StoredFile> = {}): void {
    this.files.set(key, { data, contentType, etag: `"etag-${key.length}-${data.length}"`, ...extra });
  }

  private meta(file: StoredFile, length = file.data.length): ObjectMeta {
    return { contentType: file.contentType, contentEncoding: file.contentEncoding ?? null, contentLength: length, etag: file.etag ?? null };
  }

  async head(key: string): Promise<ObjectMeta | null> {
    this.heads.push(key);
    const file = this.files.get(key);
    return file ? this.meta(file) : null;
  }

  async get(key: string, range: string | null): Promise<ObjectBody | RangeNotSatisfiable | null> {
    this.gets.push(key);
    const file = this.files.get(key);
    if (!file) return null;
    let data = file.data;
    let status: 200 | 206 = 200;
    let contentRange: string | null = null;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return { rangeNotSatisfiable: true };
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
      if (start >= data.length) return { rangeNotSatisfiable: true };
      data = data.slice(start, end + 1);
      status = 206;
      contentRange = `bytes ${start}-${end}/${file.data.length}`;
    }
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(data));
        controller.close();
      },
    });
    return { ...this.meta(file, data.length), status, contentRange, body };
  }
}

export class FakeDelivery implements DeliveryLookup {
  games = new Map<string, Delivery>();
  failing = false;
  lookups = 0;

  async find(publicId: string): Promise<Delivery | null> {
    this.lookups += 1;
    if (this.failing) throw new (await import("../src/delivery.ts")).DeliveryUnavailable("down");
    return this.games.get(publicId) ?? null;
  }
}

export function request(host: string, path = "/", init: { method?: string; headers?: Record<string, string> } = {}): Request {
  return new Request(`http://${host}${path}`, { method: init.method ?? "GET", headers: { host, ...(init.headers ?? {}) } });
}
