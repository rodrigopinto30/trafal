export type Delivery = { state: "published"; versionNumber: number; entryPath: string; needsIsolation: boolean } | { state: "gone" };

/** Which version of a game to serve (or whether it is gone). null means «no such game». */
export interface DeliveryLookup {
  find(publicId: string): Promise<Delivery | null>;
}

export class DeliveryUnavailable extends Error {}

type Row = { state: string; version_number: number | null; needs_isolation: boolean | null; entry_path: string | null };

function toDelivery(row: Row | undefined): Delivery | null {
  if (!row) return null;
  if (row.state === "gone") return { state: "gone" };
  if (row.state === "published" && row.version_number !== null) {
    return { state: "published", versionNumber: row.version_number, entryPath: row.entry_path || "index.html", needsIsolation: row.needs_isolation === true };
  }
  return null;
}

/** Asks the public API of the database (the game_delivery function, callable with the publishable key). */
export class SupabaseDeliveryLookup implements DeliveryLookup {
  private readonly url: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  constructor(url: string, key: string, fetchImpl: typeof fetch = fetch) {
    this.url = url;
    this.key = key;
    this.fetchImpl = fetchImpl;
  }

  async find(publicId: string): Promise<Delivery | null> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.url}/rest/v1/rpc/game_delivery`, {
        method: "POST",
        headers: { apikey: this.key, "content-type": "application/json" },
        body: JSON.stringify({ p_public_id: publicId }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      throw new DeliveryUnavailable("could not reach the database", { cause: error });
    }
    if (!response.ok) throw new DeliveryUnavailable(`the database answered ${response.status}`);
    const rows = (await response.json()) as Row[];
    return toDelivery(rows[0]);
  }
}

const MAX_CACHED_GAMES = 2000;
const NOT_FOUND_SECONDS = 5;

/**
 * Remembers answers for a few seconds so a page load (one HTML file and dozens of assets) is one database query, not dozens.
 * That is also the delay before a game that was hidden or taken down stops being served.
 */
export class CachedDeliveryLookup implements DeliveryLookup {
  private readonly inner: DeliveryLookup;
  private readonly seconds: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, { value: Delivery | null; expiresAt: number }>();

  constructor(inner: DeliveryLookup, seconds: number, now: () => number = Date.now) {
    this.inner = inner;
    this.seconds = seconds;
    this.now = now;
  }

  async find(publicId: string): Promise<Delivery | null> {
    const cached = this.entries.get(publicId);
    if (cached && cached.expiresAt > this.now()) return cached.value;
    const value = await this.inner.find(publicId);
    if (this.entries.size >= MAX_CACHED_GAMES) this.entries.clear();
    const ttl = value === null ? Math.min(NOT_FOUND_SECONDS, this.seconds) : this.seconds;
    this.entries.set(publicId, { value, expiresAt: this.now() + ttl * 1000 });
    return value;
  }
}
