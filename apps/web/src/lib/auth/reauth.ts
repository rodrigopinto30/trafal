export type ReauthMethod = "password" | "email";

/**
 * How someone proves it is them before something that cannot be undone: with their password if the account has one, or, for an
 * account that only signs in with a provider such as Google (which has no password here), by typing their email.
 */
export function reauthMethodOf(user: { app_metadata?: { providers?: unknown } | null }): ReauthMethod {
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("email") ? "password" : "email";
}

/** Does what the person typed match the email of their account (ignoring case and stray spaces)? */
export function emailMatches(typed: string, accountEmail: string | null | undefined): boolean {
  return !!accountEmail && typed.trim().toLowerCase() === accountEmail.trim().toLowerCase();
}
