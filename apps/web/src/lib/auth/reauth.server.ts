import "server-only";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnv } from "@/lib/env.server";
import { authErrorKey, type AuthErrorKey } from "./errors";

export type PasswordCheck = { ok: true } | { ok: false; reason: AuthErrorKey };

/**
 * Checks a password against Supabase Auth without touching the person's session: it signs in with a client that keeps nothing (no
 * cookies, no storage), so the signed-in session stays exactly as it was. The extra session this opens is left to expire.
 */
export async function checkPassword(email: string, password: string): Promise<PasswordCheck> {
  const { url, key } = assertSupabaseEnv();
  const stateless = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await stateless.auth.signInWithPassword({ email, password });
  return error ? { ok: false, reason: authErrorKey(error) } : { ok: true };
}
