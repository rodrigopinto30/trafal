"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { localizePath } from "@/i18n/path";
import { getTranslationsFor } from "@/i18n/server";
import { publicEnv } from "@/lib/env";
import { readText, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import {
  AUTH_FORM_ERROR_KEYS,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation/auth";
import { parseLocale, parseNextPath } from "@/lib/validation/common";
import { fieldErrorsFrom, sanitizeLine } from "@/lib/validation/text";
import { getAuthUser } from "./dal";
import { authErrorKey } from "./errors";
import { syncLocaleFromAccount } from "./locale";
import { MIN_AGE, TERMS_VERSION } from "./terms";

/* ---------------------------------------------------------------------------------------------
 * Todas las acciones reciben el idioma (campo oculto «lang»): en una Server Action no se puede usar
 * next/root-params, y los mensajes de error y las redirecciones tienen que salir en el idioma correcto.
 *
 * Nada de lo que llega del navegador se usa sin pasar por un esquema de Zod (lib/validation/auth.ts): el navegador
 * no es de fiar, así que esta es la validación que vale.
 * ------------------------------------------------------------------------------------------- */

function readLocale(formData: FormData): Locale {
  return parseLocale(formData.get("lang"));
}

function readNext(formData: FormData): string {
  return parseNextPath(formData.get("next")) ?? "/";
}

/** Después de iniciar sesión: ¿ya tiene perfil? Si no, a completar el onboarding. */
async function destinationAfterLogin(locale: Locale, next: string, userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!data) return localizePath(locale, `/onboarding?next=${encodeURIComponent(next)}`);
  return localizePath(locale, next);
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = readLocale(formData);
  const t = getTranslationsFor(locale, "auth");
  const next = readNext(formData);
  const typedEmail = sanitizeLine(readText(formData, "email"));

  const parsed = loginSchema.safeParse({ email: typedEmail, password: readText(formData, "password") });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error, AUTH_FORM_ERROR_KEYS, (key) => t(`errors.${key}`, { age: MIN_AGE }), "generic");
    return { status: "error", fieldErrors, values: { email: typedEmail } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { status: "error", message: t(`errors.${authErrorKey(error ?? {})}`), values: { email: parsed.data.email } };
  }

  // El idioma guardado en la cuenta manda sobre el del navegador: se recuerda en este dispositivo y se usa para el destino.
  const accountLocale = await syncLocaleFromAccount(data.user.id);
  revalidatePath("/", "layout"); // la barra pasa de «Iniciar sesión» al menú de la cuenta
  redirect(await destinationAfterLogin(accountLocale ?? locale, next, data.user.id));
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = readLocale(formData);
  const t = getTranslationsFor(locale, "auth");
  const typedEmail = sanitizeLine(readText(formData, "email"));
  const consent = formData.get("consent") === "on";
  const values = { email: typedEmail, consent: consent ? "on" : "" };

  const parsed = signupSchema.safeParse({
    email: typedEmail,
    password: readText(formData, "password"),
    confirm: readText(formData, "confirm"),
    consent,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error, AUTH_FORM_ERROR_KEYS, (key) => t(`errors.${key}`, { age: MIN_AGE }), "generic");
    return { status: "error", fieldErrors, values };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // La metadata deja constancia de que marcó la casilla (18+ y términos); el onboarding no la vuelve a pedir.
    options: { data: { locale, terms_version: TERMS_VERSION, age_confirmed: true } },
  });
  if (error) {
    return { status: "error", message: t(`errors.${authErrorKey(error)}`), values: { email, consent: "on" } };
  }

  // Sin confirmación de email obligatoria ya hay sesión; con confirmación, hay que revisar el mail.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(localizePath(locale, "/onboarding"));
  }

  // Si el email ya tenía cuenta, Supabase responde igual (a propósito, para no revelar qué emails existen).
  return { status: "success", sentTo: email };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = readLocale(formData);
  const t = getTranslationsFor(locale, "auth");
  const typedEmail = sanitizeLine(readText(formData, "email"));

  const parsed = forgotPasswordSchema.safeParse({ email: typedEmail });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error, AUTH_FORM_ERROR_KEYS, (key) => t(`errors.${key}`, { age: MIN_AGE }), "generic");
    return { status: "error", fieldErrors, values: { email: typedEmail } };
  }

  const { email } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  // Solo se informa el límite de intentos; cualquier otro resultado es «listo, revisá tu email» (sin revelar si existe).
  if (error && authErrorKey(error) === "rateLimited") {
    return { status: "error", message: t("errors.rateLimited"), values: { email } };
  }
  return { status: "success", sentTo: email };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = readLocale(formData);
  const t = getTranslationsFor(locale, "auth");

  const parsed = resetPasswordSchema.safeParse({
    password: readText(formData, "password"),
    confirm: readText(formData, "confirm"),
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error, AUTH_FORM_ERROR_KEYS, (key) => t(`errors.${key}`, { age: MIN_AGE }), "generic");
    return { status: "error", fieldErrors };
  }

  // El link del mail dejó una sesión de recuperación; sin ella no se puede cambiar la contraseña.
  const user = await getAuthUser();
  if (!user) return { status: "error", message: t("errors.linkExpired") };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: t(`errors.${authErrorKey(error)}`) };

  revalidatePath("/", "layout");
  redirect(localizePath(locale, "/"));
}

export async function googleAction(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  const next = localizePath(locale, readNext(formData));

  if (!publicEnv.googleEnabled) redirect(localizePath(locale, "/login?error=oauthFailed"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(localizePath(locale, "/login?error=oauthFailed"));
  redirect(data.url);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = readLocale(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(localizePath(locale, "/"));
}
