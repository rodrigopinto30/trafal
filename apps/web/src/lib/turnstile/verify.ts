import "server-only";
import { publicEnv } from "@/lib/env";
import { isPublicSite } from "@/lib/seo/site";

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5_000;
const TOKEN_MAX_LENGTH = 2_048;

/**
 * missing: the person did not solve it; failed: Cloudflare says it is not valid (or it was already used); unavailable: Cloudflare could
 * not be asked; misconfigured: the site is public and has no secret key (nobody can pass until it is set).
 */
export type CaptchaResult = { ok: true } | { ok: false; reason: "missing" | "failed" | "unavailable" | "misconfigured" };

export type CaptchaConfig = {
  secret: string;
  /** Whether a captcha is demanded. A public site always demands it; a local one only if it has keys. */
  required: boolean;
  /** On a public site, the host the captcha has to have been solved on (Cloudflare's test keys answer for another one). */
  expectedHostname?: string | null;
  fetchImpl?: typeof fetch;
};

/** What the answer must also match: the form it was solved for, and who solved it (Cloudflare compares the address). */
export type CaptchaCheck = { action?: string; remoteIp?: string | null };

/** The configuration of this server: the secret key from the environment, and whether the site is public (then the captcha is not optional). */
export function currentCaptchaConfig(): CaptchaConfig {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  const isPublic = isPublicSite(publicEnv.siteUrl);
  return { secret, required: secret !== "" || isPublic, expectedHostname: isPublic ? new URL(publicEnv.siteUrl).hostname : null };
}

/**
 * Asks Cloudflare whether the token of a solved captcha is valid. Fails closed: a public site without a secret key, and any problem
 * reaching Cloudflare, refuse the request (and are logged) instead of letting it through. A local site with no keys has no captcha.
 * On a public site the answer must also come from this site and from the same form (a token solved elsewhere is refused).
 */
export async function verifyTurnstile(token: string, config: CaptchaConfig = currentCaptchaConfig(), check: CaptchaCheck = {}): Promise<CaptchaResult> {
  if (!config.required) return { ok: true };
  if (config.secret === "") {
    console.error("[captcha] the site is public but TURNSTILE_SECRET_KEY is not set: every request that needs a captcha is refused");
    return { ok: false, reason: "misconfigured" };
  }
  if (token === "" || token.length > TOKEN_MAX_LENGTH) return { ok: false, reason: "missing" };

  try {
    const response = await (config.fetchImpl ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: config.secret, response: token, ...(check.remoteIp ? { remoteip: check.remoteIp } : {}) }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[captcha] Cloudflare answered with status", response.status);
      return { ok: false, reason: "unavailable" };
    }
    const result = (await response.json()) as { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[] };
    if (result.success === true) {
      if (config.expectedHostname && result.hostname !== config.expectedHostname) return { ok: false, reason: "failed" };
      if (config.expectedHostname && check.action && result.action !== check.action) return { ok: false, reason: "failed" };
      return { ok: true };
    }
    const codes = result["error-codes"] ?? [];
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
      console.error("[captcha] Cloudflare rejected the secret key", codes);
      return { ok: false, reason: "misconfigured" };
    }
    return { ok: false, reason: "failed" };
  } catch (error) {
    console.error("[captcha] could not ask Cloudflare", error);
    return { ok: false, reason: "unavailable" };
  }
}
