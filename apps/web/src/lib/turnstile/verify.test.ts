import { afterEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_VERIFY_URL, currentCaptchaConfig, verifyTurnstile, type CaptchaConfig } from "./verify";

const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const config = (fetchImpl: CaptchaConfig["fetchImpl"], overrides: Partial<CaptchaConfig> = {}): CaptchaConfig => ({ secret: "secret", required: true, fetchImpl, ...overrides });

afterEach(() => vi.restoreAllMocks());

describe("verifyTurnstile", () => {
  it("accepts what Cloudflare accepts, sending the secret and the token and nothing else", async () => {
    const fetchImpl = answer({ success: true });
    expect(await verifyTurnstile("token-1", config(fetchImpl))).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(init.method).toBe("POST");
    expect(String(init.body)).toBe("secret=secret&response=token-1");
  });

  it("refuses what Cloudflare refuses", async () => {
    expect(await verifyTurnstile("token", config(answer({ success: false, "error-codes": ["timeout-or-duplicate"] })))).toEqual({ ok: false, reason: "failed" });
    expect(await verifyTurnstile("token", config(answer({ success: false, "error-codes": ["invalid-input-response"] })))).toEqual({ ok: false, reason: "failed" });
  });

  it("does not even ask when there is no token, or it is absurdly long", async () => {
    const fetchImpl = answer({ success: true });
    expect(await verifyTurnstile("", config(fetchImpl))).toEqual({ ok: false, reason: "missing" });
    expect(await verifyTurnstile("x".repeat(2049), config(fetchImpl))).toEqual({ ok: false, reason: "missing" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare cannot be reached or answers badly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await verifyTurnstile("token", config(vi.fn(async () => Promise.reject(new Error("network")))))).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyTurnstile("token", config(answer({}, 500)))).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyTurnstile("token", config(vi.fn(async () => new Response("not json", { status: 200 }))))).toEqual({ ok: false, reason: "unavailable" });
  });

  it("tells a wrong secret apart from a wrong answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await verifyTurnstile("token", config(answer({ success: false, "error-codes": ["invalid-input-secret"] })))).toEqual({ ok: false, reason: "misconfigured" });
  });

  it("has no captcha on a site that does not demand one (local, no keys)", async () => {
    const fetchImpl = answer({ success: false });
    expect(await verifyTurnstile("", config(fetchImpl, { secret: "", required: false }))).toEqual({ ok: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses everything on a public site that has no secret key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = answer({ success: true });
    expect(await verifyTurnstile("token", config(fetchImpl, { secret: "", required: true }))).toEqual({ ok: false, reason: "misconfigured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("currentCaptchaConfig", () => {
  it("demands the captcha as soon as there is a secret key", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "a-secret");
    expect(currentCaptchaConfig()).toMatchObject({ secret: "a-secret", required: true });
    vi.unstubAllEnvs();
  });

  it("does not demand it on a local site with no keys", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(currentCaptchaConfig()).toMatchObject({ secret: "", required: false });
    vi.unstubAllEnvs();
  });
});
