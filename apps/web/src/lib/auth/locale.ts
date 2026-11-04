import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Guarda el idioma en la cookie que lee el proxy para decidir en qué idioma mostrar las URLs sin prefijo. */
export async function setLocaleCookie(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: ONE_YEAR, path: "/", sameSite: "lax" });
}

/**
 * Al iniciar sesión (con contraseña, con el link del mail o con Google), el idioma guardado en la cuenta pasa a ser el
 * que se usa en este dispositivo. Sin esto, quien eligió inglés en la configuración y entra desde una compu nueva vería
 * el idioma del sistema hasta volver a cambiarlo. Devuelve el idioma de la cuenta, o null si todavía no tiene perfil.
 */
export async function syncLocaleFromAccount(userId: string): Promise<Locale | null> {
  const supabase = await createClient();
  // RLS: solo se puede leer la propia fila de profile_private.
  const { data } = await supabase.from("profile_private").select("locale").eq("id", userId).maybeSingle();
  if (!isLocale(data?.locale)) return null;
  await setLocaleCookie(data.locale);
  return data.locale;
}
