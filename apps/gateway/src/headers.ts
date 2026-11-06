import type { GatewayConfig } from "./config.ts";

const PERMISSIONS_POLICY = [
  "accelerometer=(self)",
  "autoplay=(self)",
  "camera=()",
  "display-capture=()",
  "fullscreen=(self)",
  "gamepad=(self)",
  "geolocation=()",
  "gyroscope=(self)",
  "microphone=()",
  "midi=()",
  "payment=()",
  "usb=()",
  "clipboard-write=(self)",
].join(", ");

/**
 * Content-Security-Policy of a game. A game may run its own code (including eval and WebAssembly, which engines need) but
 * can only talk to its own origin: no external requests, no forms, no plugins, no nested frames, and it can only be framed
 * by Trafal. Scripts, styles and fonts may come from a short allowlist of public CDNs (Phaser and Google Fonts are common).
 */
export function contentSecurityPolicy(config: GatewayConfig): string {
  const join = (sources: string[]) => sources.join(" ");
  return [
    "default-src 'self' blob: data:",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${join(config.cdnScriptSources)}`,
    `style-src 'self' 'unsafe-inline' blob: data: ${join(config.cdnStyleSources)}`,
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    `font-src 'self' data: ${join(config.cdnFontSources)}`,
    "connect-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    `frame-ancestors ${config.siteOrigin}`,
  ].join("; ");
}

/** Headers every response of the gateway carries, errors and redirects included. */
export function securityHeaders(config: GatewayConfig): Headers {
  return new Headers({
    "Content-Security-Policy": contentSecurityPolicy(config),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow",
    Vary: "Sec-Fetch-Dest",
  });
}
