import "server-only";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "@/i18n/server";
import { localizePath } from "@/i18n/path";
import { createClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "./terms";

/**
 * Capa de acceso a datos de la sesión (patrón «Data Access Layer»). Toda pregunta de «¿quién es?» pasa por
 * acá. Se usa getUser() (que valida el token contra Supabase Auth) y no getSession(): la cookie se puede
 * falsificar, el token validado no. `cache` evita repetir la consulta dentro del mismo request.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

/** How recent a sign-in has to be for what cannot be undone (the database asks the same: `private.recently_authenticated`). */
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

/** How long the session left by a password reset email can be used to choose the new password. */
export const PASSWORD_RESET_SECONDS = 15 * 60;

/**
 * Whether the current session signed in within the given seconds, optionally with one method: «password», «oauth», or «otp» (the
 * link of an email, such as the password reset one). Read from the verified token's `amr` claim.
 */
export async function signedInRecently(withinSeconds: number, method?: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const methods: unknown = data?.claims?.amr;
  if (!Array.isArray(methods)) return false;
  const since = Date.now() / 1000 - withinSeconds;
  return methods.some(
    (entry: { method?: unknown; timestamp?: unknown }) =>
      typeof entry?.timestamp === "number" && entry.timestamp >= since && (method === undefined || entry.method === method),
  );
}

export const PROFILE_COLUMNS =
  "id, username, display_name, avatar_path, bio, city, country, favorite_genres, followers_count, following_count, created_at" as const;

/** Perfil de la persona con sesión iniciada, o null si no hay sesión o todavía no hizo el onboarding. */
export const getMyProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
  return data;
});

/** El estado privado de la cuenta con sesión (rol, suspensión y versión de los términos aceptada). Se pide una sola vez por pedido: lo usan el menú, el aviso de suspensión y el panel. */
const getMyAccountState = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profile_private").select("role, status, suspended_until, suspension_reason, terms_version").eq("id", user.id).maybeSingle();
  return data;
});

/** ¿La persona con sesión es admin (y su cuenta está activa)? Lo decide la base; esto solo lo pregunta para mostrar u ocultar la interfaz. */
export const getIsAdmin = cache(async (): Promise<boolean> => {
  const data = await getMyAccountState();
  if (data?.role !== "admin") return false;
  return data.status === "active" || (data.suspended_until !== null && Date.parse(data.suspended_until) <= Date.now());
});

/** La suspensión vigente de la cuenta con sesión (con su motivo y hasta cuándo), o null si puede escribir. La lee la propia persona: la base se lo deja ver. */
export const getMySuspension = cache(async (): Promise<{ reason: string | null; until: string | null } | null> => {
  const data = await getMyAccountState();
  if (data?.status !== "suspended") return null;
  if (data.suspended_until !== null && Date.parse(data.suspended_until) <= Date.now()) return null;
  return { reason: data.suspension_reason, until: data.suspended_until };
});

/** ¿La cuenta con sesión aceptó una versión anterior de los términos (hay que pedirle que acepte la vigente)? Quien todavía no tiene perfil no cuenta: el onboarding se los pide. */
export const hasOutdatedTerms = cache(async (): Promise<boolean> => {
  const data = await getMyAccountState();
  return data !== null && data.terms_version !== TERMS_VERSION;
});

/** Para las pantallas de administración: sin sesión → login; sin ser admin → 404 (no se anuncia que existen). */
export async function requireAdmin(returnTo: string): Promise<User> {
  const user = await requireUser(returnTo);
  if (!(await getIsAdmin())) notFound();
  return user;
}

/** Para páginas que exigen sesión: si no hay, manda a iniciar sesión y vuelve después a `returnTo`. */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getAuthUser();
  if (!user) {
    const locale = await getLocale();
    redirect(localizePath(locale, `/login?next=${encodeURIComponent(returnTo)}`));
  }
  return user;
}

/**
 * Para páginas que exigen perfil completo: sin sesión → login; sin perfil → onboarding; con una versión vieja de los términos →
 * pantalla para aceptar la vigente (salvo que la página tenga que seguir disponible, como la de borrar la cuenta).
 */
export async function requireProfile(returnTo: string, options: { allowOutdatedTerms?: boolean } = {}) {
  const user = await requireUser(returnTo);
  const profile = await getMyProfile();
  if (!profile) {
    const locale = await getLocale();
    redirect(localizePath(locale, `/onboarding?next=${encodeURIComponent(returnTo)}`));
  }
  if (!options.allowOutdatedTerms && (await hasOutdatedTerms())) {
    const locale = await getLocale();
    redirect(localizePath(locale, `/accept-terms?next=${encodeURIComponent(returnTo)}`));
  }
  return { user, profile };
}

/** ¿Aceptó los términos y confirmó la edad al registrarse (casilla del formulario, guardada en la metadata)? */
export function consentedAtSignup(user: User): boolean {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return meta?.terms_version === TERMS_VERSION && meta?.age_confirmed === true;
}
