import { BRIDGE_VERSION, injectBridge } from "./bridge.ts";
import type { GatewayConfig } from "./config.ts";
import { DeliveryUnavailable, type DeliveryLookup } from "./delivery.ts";
import { securityHeaders } from "./headers.ts";
import { publicIdFromHost } from "./host.ts";
import { resolveObjectPath } from "./path.ts";
import type { GameStorage, ObjectMeta } from "./storage.ts";

export type GatewayDependencies = { config: GatewayConfig; delivery: DeliveryLookup; storage: GameStorage };

const HTML_ALLOWED_DESTINATIONS = new Set(["iframe", "empty"]);
const PAGE_DESTINATIONS = new Set(["", "document", "frame", "iframe", "embed", "object"]);
const SERVICE_WORKER_DESTINATION = "serviceworker";

/** Kinds of files a browser also opens as a page of their own, with scripts: an SVG drawing, XHTML and XML. */
const OTHER_PAGE_TYPES = ["application/xhtml+xml", "image/svg+xml", "application/xml", "text/xml"];

/** Nothing of a file of those kinds runs, if a browser ever opens it as a page: it only shows. */
const STATIC_DOCUMENT_POLICY = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";

function text(config: GatewayConfig, status: number, body: string, extra: Record<string, string> = {}, head = false): Response {
  const headers = securityHeaders(config);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(head ? null : body, { status, headers });
}

function entityTag(versionNumber: number, etag: string | null, bridged = false): string | null {
  return etag ? `"v${versionNumber}-${etag.replaceAll('"', "")}${bridged ? `-b${BRIDGE_VERSION}` : ""}"` : null;
}

function matchesEntityTag(ifNoneMatch: string | null, current: string | null): boolean {
  if (!ifNoneMatch || !current) return false;
  return ifNoneMatch.split(",").some((candidate) => candidate.trim().replace(/^W\//, "") === current);
}

function isHtml(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("text/html");
}

function isOtherPageType(contentType: string): boolean {
  const type = contentType.toLowerCase();
  return OTHER_PAGE_TYPES.some((page) => type.startsWith(page));
}

/**
 * Whether this response could be opened as a page outside Tradfal's frame: HTML anywhere but the frame and the game's own requests,
 * and an SVG or XML file as a page (it can still be an image, a style or data the game reads).
 */
function wouldOpenAsLoosePage(contentType: string, destination: string | null): boolean {
  if (isHtml(contentType)) return !HTML_ALLOWED_DESTINATIONS.has(destination ?? "");
  return isOtherPageType(contentType) && PAGE_DESTINATIONS.has(destination ?? "");
}

function deliveryHeaders(config: GatewayConfig, meta: ObjectMeta, etag: string | null): Headers {
  const headers = securityHeaders(config);
  headers.set("Content-Type", meta.contentType);
  if (isOtherPageType(meta.contentType)) headers.set("Content-Security-Policy", STATIC_DOCUMENT_POLICY);
  if (meta.contentEncoding) headers.set("Content-Encoding", meta.contentEncoding);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-cache");
  if (etag) headers.set("ETag", etag);
  return headers;
}

/**
 * Handler of the games gateway, written against the standard Request/Response so the same code runs on Node (local
 * development, a container) and on Cloudflare Workers. It serves GET and HEAD only, for hosts of the form
 * <public_id>.<games domain>, and answers every request, errors included, with the security headers.
 *
 * HTML is only served inside a frame of Tradfal (Sec-Fetch-Dest: iframe) or to the game's own scripts (empty): opening a game
 * URL directly sends the person to the game's page on Tradfal, so a game can never pose as a page of its own to phish. The same
 * goes for SVG and XML files, which a browser also runs as pages: they are served as images or data, never as a page.
 * What is decided and what is served come from the same description of the file (its type and encoding).
 * The HTML that does go into a frame carries the platform bridge (see bridge.ts), streamed in at the top of the page, so the player's
 * own controls (mute) work for every game; it is not added to ranges, encoded bodies or the game's own fetches.
 * Service worker scripts are never served (Sec-Fetch-Dest: serviceworker): a worker would outlive the game being hidden or
 * replaced and keep answering for its origin.
 */
export function createGatewayHandler({ config, delivery, storage }: GatewayDependencies) {
  return async function handle(request: Request): Promise<Response> {
    const head = request.method === "HEAD";
    if (request.method !== "GET" && !head) return text(config, 405, "Method not allowed", { Allow: "GET, HEAD" });

    if (request.headers.get("sec-fetch-dest") === SERVICE_WORKER_DESTINATION) return text(config, 403, "Service workers are not allowed", {}, head);

    const url = new URL(request.url);
    const publicId = publicIdFromHost(request.headers.get("host") ?? url.host, config.gamesDomain);
    if (!publicId) return text(config, 404, "Not found", {}, head);

    let found;
    try {
      found = await delivery.find(publicId);
    } catch (error) {
      if (error instanceof DeliveryUnavailable) return text(config, 503, "Temporarily unavailable", { "Retry-After": "5" }, head);
      throw error;
    }
    if (!found) return text(config, 404, "Not found", {}, head);
    if (found.state === "gone") return text(config, 410, "This game is no longer available", {}, head);

    const objectPath = resolveObjectPath(url.pathname, found.entryPath);
    if (!objectPath) return text(config, 404, "Not found", {}, head);
    const key = `${publicId}/v${found.versionNumber}/${objectPath}`;
    const destination = request.headers.get("sec-fetch-dest");
    const ifNoneMatch = request.headers.get("if-none-match");

    const meta = await storage.head(key);
    if (!meta) return text(config, 404, "Not found", {}, head);
    if (wouldOpenAsLoosePage(meta.contentType, destination)) {
      return text(config, 302, "", { Location: `${config.siteUrl}/games/${publicId}` }, true);
    }
    const bridged = isHtml(meta.contentType) && destination === "iframe" && !meta.contentEncoding && !request.headers.has("range");
    const etag = entityTag(found.versionNumber, meta.etag, bridged);
    if (matchesEntityTag(ifNoneMatch, etag)) {
      const headers = deliveryHeaders(config, meta, etag);
      headers.delete("Content-Type");
      return new Response(null, { status: 304, headers });
    }
    if (head) {
      const headers = deliveryHeaders(config, meta, etag);
      if (bridged) headers.set("Accept-Ranges", "none");
      else headers.set("Content-Length", String(meta.contentLength));
      return new Response(null, { status: 200, headers });
    }

    const object = await storage.get(key, request.headers.get("range"));
    if (!object) return text(config, 404, "Not found");
    if ("rangeNotSatisfiable" in object) return text(config, 416, "Range not satisfiable", { "Content-Range": `bytes */${meta.contentLength}` });
    const served = { ...object, contentType: meta.contentType, contentEncoding: meta.contentEncoding };
    if (bridged && object.status === 200) {
      const headers = deliveryHeaders(config, served, entityTag(found.versionNumber, object.etag, true));
      headers.set("Accept-Ranges", "none");
      return new Response(injectBridge(object.body), { status: 200, headers });
    }
    const headers = deliveryHeaders(config, served, entityTag(found.versionNumber, object.etag));
    headers.set("Content-Length", String(object.contentLength));
    if (object.contentRange) headers.set("Content-Range", object.contentRange);
    return new Response(object.body, { status: object.status, headers });
  };
}
