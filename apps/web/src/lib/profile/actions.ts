"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localizePath } from "@/i18n/path";
import { getTranslationsFor } from "@/i18n/server";
import { consentedAtSignup, getAuthUser } from "@/lib/auth/dal";
import { onboardingErrorCode } from "@/lib/auth/errors";
import { MIN_AGE, TERMS_VERSION } from "@/lib/auth/terms";
import { readText, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { parseLocale, parseNextPath } from "@/lib/validation/common";
import {
  ONBOARDING_FORM_ERROR_KEYS,
  SETTINGS_FORM_ERROR_KEYS,
  followSchema,
  onboardingSchema,
  updateProfileSchema,
} from "@/lib/validation/profile";
import { fieldErrorsFrom, sanitizeLine } from "@/lib/validation/text";

/* Todo lo que llega del navegador pasa por un esquema de Zod (lib/validation/profile.ts) antes de tocar la base. */

export async function onboardingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = parseLocale(formData.get("lang"));
  const t = getTranslationsFor(locale, "onboarding");
  const next = parseNextPath(readText(formData, "next"));

  const user = await getAuthUser();
  if (!user) redirect(localizePath(locale, "/login"));

  // Quien se registró con la casilla ya aceptó; quien entró con Google la marca acá.
  const consented = formData.get("consent") === "on" || consentedAtSignup(user);

  const typed = {
    username: sanitizeLine(readText(formData, "username")),
    displayName: sanitizeLine(readText(formData, "displayName")),
  };
  const parsed = onboardingSchema.safeParse(typed);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsFrom(parsed.error, ONBOARDING_FORM_ERROR_KEYS, (key) => t(`errors.${key}`, { age: MIN_AGE }), "generic"),
      values: { ...typed, consent: consented ? "on" : "" },
    };
  }

  const { username, displayName } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_onboarding", {
    p_username: username,
    p_display_name: displayName,
    p_terms_version: TERMS_VERSION,
    p_accept_terms: consented,
    p_age_confirmed: consented,
    p_locale: locale,
  });

  if (error) {
    const code = onboardingErrorCode(error.message);
    if (code === "already_onboarded") redirect(localizePath(locale, next ?? "/"));
    const fieldErrors: Record<string, string> = {};
    if (code === "username_taken" || code === "invalid_username" || code === "reserved_username") {
      fieldErrors.username = t(`errors.${code}`);
    } else if (code === "invalid_display_name") {
      fieldErrors.displayName = t("errors.invalid_display_name");
    } else if (code === "age_confirmation_required") {
      fieldErrors.consent = t("errors.age_confirmation_required", { age: MIN_AGE });
    } else if (code === "terms_required") {
      fieldErrors.consent = t("errors.terms_required");
    }
    return {
      status: "error",
      message: Object.keys(fieldErrors).length === 0 ? t(`errors.${code}`, { age: MIN_AGE }) : undefined,
      fieldErrors,
      values: { username, displayName, consent: consented ? "on" : "" },
    };
  }

  // La barra de navegación vive en el layout (que se conserva entre páginas): hay que pedirla de nuevo para que
  // pase de «sin perfil» a mostrar el menú de la cuenta.
  revalidatePath("/", "layout");
  redirect(localizePath(locale, next ?? `/u/${data.username}`));
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = parseLocale(formData.get("lang"));
  const t = getTranslationsFor(locale, "settings");
  const tOnboarding = getTranslationsFor(locale, "onboarding");

  const user = await getAuthUser();
  if (!user) redirect(localizePath(locale, "/login?next=%2Fsettings%2Fprofile"));

  const typed = {
    displayName: readText(formData, "displayName"),
    bio: readText(formData, "bio"),
    city: readText(formData, "city"),
    country: readText(formData, "country"),
    engines: formData.getAll("engines").filter((value): value is string => typeof value === "string"),
    favoriteGenres: formData.getAll("favoriteGenres").filter((value): value is string => typeof value === "string"),
  };
  // Para devolver el formulario como lo dejó la persona si hay errores.
  const typedValues = {
    displayName: typed.displayName,
    bio: typed.bio,
    city: typed.city,
    country: typed.country,
    engines: typed.engines.join(","),
    favoriteGenres: typed.favoriteGenres.join(","),
  };

  const parsed = updateProfileSchema.safeParse(typed);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(
      parsed.error,
      SETTINGS_FORM_ERROR_KEYS,
      (key) => (key === "invalid_display_name" ? tOnboarding("errors.invalid_display_name") : t(`errors.${key}`)),
      "generic",
    );
    return { status: "error", fieldErrors, values: typedValues };
  }

  const { displayName, bio, city, country, engines, favoriteGenres } = parsed.data;
  const values = {
    displayName,
    bio,
    city: city ?? "",
    country: country ?? "",
    engines: engines.join(","),
    favoriteGenres: favoriteGenres.join(","),
  };

  const supabase = await createClient();
  // RLS garantiza que solo se pueda editar la fila propia y solo estas columnas. El .select() permite notar si RLS
  // filtró la fila (cuenta suspendida): en ese caso la actualización «funciona» pero no cambia nada.
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, bio, city, country, engines, favorite_genres: favoriteGenres })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) return { status: "error", message: t("errors.generic"), values };
  revalidatePath("/", "layout"); // el nombre también se ve en el menú de la cuenta
  return { status: "success", message: t("profile.saved"), values };
}

export type FollowResult =
  | { ok: true; following: boolean; followersCount: number }
  | { ok: false; reason: "unauthenticated" | "invalid" | "error" };

/** Seguir / dejar de seguir. Devuelve el contador actualizado para que la interfaz no tenga que adivinarlo. */
export async function toggleFollowAction(input: { targetId: string; follow: boolean }): Promise<FollowResult> {
  const parsed = followSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const user = await getAuthUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const { targetId, follow } = parsed.data;
  const supabase = await createClient();

  if (follow) {
    const { error } = await supabase.from("follows").insert({ follower_id: user.id, followee_id: targetId });
    // 23505 = ya lo seguía (doble click / otra pestaña): el resultado deseado ya se cumple.
    if (error && error.code !== "23505") return { ok: false, reason: "error" };
  } else {
    const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", targetId);
    if (error) return { ok: false, reason: "error" };
  }

  const { data } = await supabase.from("profiles").select("followers_count").eq("id", targetId).maybeSingle();
  return { ok: true, following: follow, followersCount: data?.followers_count ?? 0 };
}
