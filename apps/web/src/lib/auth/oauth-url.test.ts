import { describe, expect, it } from "vitest";
import { browserAuthUrl } from "./oauth-url";

const INTERNAL = "http://supabase_kong_trafal:8000";
const PUBLIC = "http://127.0.0.1:54321";

describe("browserAuthUrl", () => {
  it("swaps the internal Supabase address for the public one, keeping the path and the query", () => {
    expect(browserAuthUrl(`${INTERNAL}/auth/v1/authorize?provider=discord&code_challenge=abc`, INTERNAL, PUBLIC)).toBe(
      `${PUBLIC}/auth/v1/authorize?provider=discord&code_challenge=abc`,
    );
  });

  it("leaves addresses that are already public or belong to someone else", () => {
    expect(browserAuthUrl(`${PUBLIC}/auth/v1/authorize?provider=google`, INTERNAL, PUBLIC)).toBe(`${PUBLIC}/auth/v1/authorize?provider=google`);
    expect(browserAuthUrl("https://discord.com/api/oauth2/authorize?x=1", INTERNAL, PUBLIC)).toBe("https://discord.com/api/oauth2/authorize?x=1");
    expect(browserAuthUrl("https://abc.supabase.co/auth/v1/authorize", "https://abc.supabase.co", "https://abc.supabase.co")).toBe("https://abc.supabase.co/auth/v1/authorize");
  });

  it("does not break on a missing or malformed setting", () => {
    expect(browserAuthUrl(`${INTERNAL}/auth/v1/authorize`, "", PUBLIC)).toBe(`${INTERNAL}/auth/v1/authorize`);
    expect(browserAuthUrl("not a url", INTERNAL, PUBLIC)).toBe("not a url");
  });
});
