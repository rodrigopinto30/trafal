import { OAUTH_PROVIDERS, type OAuthProvider } from "@/lib/validation/auth";

export type ReauthMethod = "password" | "email";

/**
 * How someone proves it is them before something that cannot be undone: with their password if the account has one, or, for an
 * account that only signs in with a provider such as Google or Discord (which has no password here), by typing their email.
 */
export function reauthMethodOf(user: { app_metadata?: { providers?: unknown } | null }): ReauthMethod {
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("email") ? "password" : "email";
}

/** The outside accounts (Google, Discord) the person can sign in with, to sign in again before something that cannot be undone. */
export function oauthProvidersOf(user: { app_metadata?: { providers?: unknown } | null }): OAuthProvider[] {
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers) ? OAUTH_PROVIDERS.filter((provider) => providers.includes(provider)) : [];
}

/** Does what the person typed match the email of their account (ignoring case and stray spaces)? */
export function emailMatches(typed: string, accountEmail: string | null | undefined): boolean {
  return !!accountEmail && typed.trim().toLowerCase() === accountEmail.trim().toLowerCase();
}
