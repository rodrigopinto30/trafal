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
  fetchImpl?: typeof fetch;
};

/** The configuration of this server: the secret key from the environment, and whether the site is public (then the captcha is not optional). */
export function currentCaptchaConfig(): CaptchaConfig {
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  return { secret, required: secret !== "" || isPublicSite(publicEnv.siteUrl) };
}

/**
 * Asks Cloudflare whether the token of a solved captcha is valid. Fails closed: a public site without a secret key, and any problem
 * reaching Cloudflare, refuse the request (and are logged) instead of letting it through. A local site with no keys has no captcha.
 */
export async function verifyTurnstile(token: string, config: CaptchaConfig = currentCaptchaConfig()): Promise<CaptchaResult> {
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
      body: new URLSearchParams({ secret: config.secret, response: token }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[captcha] Cloudflare answered with status", response.status);
      return { ok: false, reason: "unavailable" };
    }
    const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (result.success === true) return { ok: true };
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
