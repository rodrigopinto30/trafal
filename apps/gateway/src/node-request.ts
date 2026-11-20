import type { IncomingMessage } from "node:http";

/**
 * Node adapter: turns each incoming HTTP request into a standard Request. Only the path and query of the request line are used (it
 * may come in absolute form), on the Host the request names, which the handler validates; a malformed one cannot crash the process:
 * it gets null, and a 400.
 */
export function toRequest(incoming: IncomingMessage): Request | null {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    const target = new URL(incoming.url ?? "/", "http://gateway.invalid");
    const url = new URL(`${target.pathname}${target.search}`, `http://${incoming.headers.host ?? "gateway.invalid"}`);
    return new Request(url, { method: incoming.method ?? "GET", headers });
  } catch {
    return null;
  }
}
