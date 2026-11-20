import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/database.types";
import { authErrorKey, type AuthErrorKey } from "./errors";

export type PasswordCheck = { ok: true; client: SupabaseClient<Database>; end: () => Promise<void> } | { ok: false; reason: AuthErrorKey };

/**
 * Checks a password against Supabase Auth without touching the person's session: it signs in with a client that keeps nothing (no
 * cookies, no storage), so the signed-in session stays exactly as it was. That sign-in is brand new, so `client` can do what the
 * database only allows right after signing in (deleting the account); `end` closes it when it is no longer needed.
 */
export async function checkPassword(email: string, password: string, captchaToken?: string): Promise<PasswordCheck> {
  const { url, key } = assertSupabaseEnv();
  const stateless = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await stateless.auth.signInWithPassword({ email, password, options: { captchaToken } });
  if (error || !data.session) return { ok: false, reason: error ? authErrorKey(error) : "generic" };
  const end = async () => {
    await stateless.auth.signOut({ scope: "local" });
  };
  return { ok: true, client: stateless, end };
}
