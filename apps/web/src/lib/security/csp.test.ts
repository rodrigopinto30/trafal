import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./csp";

const PRODUCTION = {
  siteUrl: "https://tradfal.example",
  supabaseUrl: "https://abc.supabase.co",
  mediaUrl: "https://media.tradfal.example/public",
  gamesBaseUrl: "https://tradfal-games.example",
  uploadUrl: "https://account.r2.cloudflarestorage.com",
  development: false,
};

function directives(policy: string): Map<string, string[]> {
  return new Map(policy.split("; ").map((directive) => {
    const [name = "", ...values] = directive.split(" ");
    return [name, values];
  }));
}

describe("contentSecurityPolicy", () => {
  it("lets each kind of resource come only from where the site keeps it", () => {
    const policy = directives(contentSecurityPolicy(PRODUCTION));
    expect(policy.get("default-src")).toEqual(["'self'"]);
    expect(policy.get("script-src")).toEqual(["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"]);
    expect(policy.get("img-src")).toEqual(["'self'", "data:", "blob:", "https://media.tradfal.example"]);
    expect(policy.get("connect-src")).toEqual([
      "'self'",
      "https://abc.supabase.co",
      "wss://abc.supabase.co",
      "https://account.r2.cloudflarestorage.com",
      "https://challenges.cloudflare.com",
    ]);
    expect(policy.get("frame-src")).toEqual(["https://*.tradfal-games.example", "https://challenges.cloudflare.com"]);
    expect(policy.get("form-action")).toEqual(["'self'", "https://abc.supabase.co", "https://accounts.google.com", "https://discord.com"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.has("upgrade-insecure-requests")).toBe(true);
  });

  it("never allows eval in production, and allows the dev server's needs only in development", () => {
    expect(contentSecurityPolicy(PRODUCTION)).not.toContain("unsafe-eval");
    const local = directives(
      contentSecurityPolicy({
        siteUrl: "http://localhost:3000",
        supabaseUrl: "http://127.0.0.1:54321",
        mediaUrl: "http://127.0.0.1:54321/storage/v1/object/public/media",
        gamesBaseUrl: "http://games.localhost:4000",
        uploadUrl: "http://127.0.0.1:54321/storage/v1/s3",
        development: true,
      }),
    );
    expect(local.get("script-src")).toContain("'unsafe-eval'");
    expect(local.get("connect-src")).toEqual(["'self'", "http://127.0.0.1:54321", "ws://127.0.0.1:54321", "https://challenges.cloudflare.com", "ws://localhost:3000", "ws://127.0.0.1:3000"]);
    expect(local.get("frame-src")).toEqual(["http://*.games.localhost:4000", "https://challenges.cloudflare.com"]);
    expect(local.has("upgrade-insecure-requests")).toBe(false);
  });

  it("leaves out an address that is missing or not http(s), instead of opening the directive", () => {
    const policy = directives(contentSecurityPolicy({ ...PRODUCTION, mediaUrl: "", uploadUrl: "javascript:alert(1)", gamesBaseUrl: "nonsense" }));
    expect(policy.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(policy.get("connect-src")).not.toContain("javascript:alert(1)");
    expect(policy.get("frame-src")).toEqual(["https://challenges.cloudflare.com"]);
  });
});
