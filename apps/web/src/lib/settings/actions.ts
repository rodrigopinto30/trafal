"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localizePath } from "@/i18n/path";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { setLocaleCookie } from "@/lib/auth/locale";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/validation/common";
import { preferencesSchema } from "@/lib/validation/profile";

/**
 * Cambia el idioma de la cuenta. Queda guardado en la base (profile_private.locale, para otros dispositivos) y en la
 * cookie que lee el proxy (para este). Si cambió, se vuelve a cargar la misma pantalla en el idioma nuevo.
 */
export async function updatePreferencesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = parseLocale(formData.get("lang")); // idioma en el que la persona está viendo la página
  const t = getTranslationsFor(current, "settings");

  const user = await getAuthUser();
  if (!user) redirect(localizePath(current, "/login?next=%2Fsettings%2Fpreferences"));

  const parsed = preferencesSchema.safeParse({ locale: formData.get("locale") });
  if (!parsed.success) return { status: "error", message: t("errors.generic") };
  const chosen = parsed.data.locale;

  const supabase = await createClient();
  // RLS: solo la propia fila, y solo la columna «locale».
  const { data, error } = await supabase.from("profile_private").update({ locale: chosen }).eq("id", user.id).select("id");
  if (error || !data?.length) return { status: "error", message: t("errors.generic") };

  await setLocaleCookie(chosen);
  revalidatePath("/", "layout");
  if (chosen !== current) redirect(localizePath(chosen, "/settings/preferences"));
  return { status: "success", message: t("preferences.saved") };
}
