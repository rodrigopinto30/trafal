import "server-only";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";
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

export const PROFILE_COLUMNS =
  "id, username, display_name, avatar_path, bio, city, country, engines, favorite_genres, followers_count, following_count, created_at" as const;

/** Perfil de la persona con sesión iniciada, o null si no hay sesión o todavía no hizo el onboarding. */
export const getMyProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
  return data;
});

/** Para páginas que exigen sesión: si no hay, manda a iniciar sesión y vuelve después a `returnTo`. */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getAuthUser();
  if (!user) {
    const locale = await getLocale();
    redirect(localizePath(locale, `/login?next=${encodeURIComponent(returnTo)}`));
  }
  return user;
}

/** Para páginas que exigen perfil completo: sin sesión → login; sin perfil → onboarding. */
export async function requireProfile(returnTo: string) {
  const user = await requireUser(returnTo);
  const profile = await getMyProfile();
  if (!profile) {
    const locale = await getLocale();
    redirect(localizePath(locale, `/onboarding?next=${encodeURIComponent(returnTo)}`));
  }
  return { user, profile };
}

/** ¿Aceptó los términos y confirmó la edad al registrarse (casilla del formulario, guardada en la metadata)? */
export function consentedAtSignup(user: User): boolean {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return meta?.terms_version === TERMS_VERSION && meta?.age_confirmed === true;
}
