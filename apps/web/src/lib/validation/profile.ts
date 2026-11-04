import { z } from "zod";
import { AVATAR_FORMATS, MAX_AVATAR_BYTES } from "@/lib/media/avatar";
import { ENGINE_IDS, GENRE_IDS, MAX_ENGINES, isCountryCode } from "@/lib/profile/catalog";
import { checkUsernameFormat, normalizeUsername } from "@/lib/username";
import { localeSchema } from "./common";
import { charLength, sanitizeLine, sanitizeMultiline, unique } from "./text";

/* ---------------------------------------------------------------------------------------------
 * Esquemas del perfil. Igual que en auth.ts, el `message` de cada regla es una CLAVE de traducción.
 *   · Onboarding: claves de «onboarding.errors» (las mismas que lanza la función SQL complete_onboarding).
 *   · Resto: claves de «settings.errors».
 * ------------------------------------------------------------------------------------------- */

export const ONBOARDING_FORM_ERROR_KEYS = ["invalid_username", "reserved_username", "invalid_display_name", "generic"] as const;
export type OnboardingFormErrorKey = (typeof ONBOARDING_FORM_ERROR_KEYS)[number];

export const SETTINGS_FORM_ERROR_KEYS = [
  "invalid_display_name",
  "bioTooLong",
  "cityTooLong",
  "invalidCountry",
  "invalidEngine",
  "tooManyEngines",
  "invalidGenre",
  "generic",
] as const;
export type SettingsFormErrorKey = (typeof SETTINGS_FORM_ERROR_KEYS)[number];

export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 280;
export const CITY_MAX = 80;

/** Nombre para mostrar: una línea, 1 a 50 caracteres, sin caracteres invisibles. */
export const displayNameSchema = z
  .string()
  .transform(sanitizeLine)
  .refine((value) => charLength(value) >= 1 && charLength(value) <= DISPLAY_NAME_MAX, "invalid_display_name");

/** @usuario: se normaliza (minúsculas, sin acentos) y después se valida la forma y que no esté reservado. */
export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .superRefine((value, ctx) => {
    const format = checkUsernameFormat(value);
    if (format === "invalid") ctx.addIssue({ code: "custom", message: "invalid_username" });
    if (format === "reserved") ctx.addIssue({ code: "custom", message: "reserved_username" });
  });

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
});

/** Lista de ids de un catálogo cerrado: sin repetidos, todos conocidos y, si corresponde, con tope. */
function catalogList(allowed: readonly string[], invalidKey: string, limit?: { max: number; key: string }) {
  return z
    .array(z.string())
    .transform((values) => unique(values.map((value) => value.trim())))
    .superRefine((values, ctx) => {
      if (values.some((value) => !allowed.includes(value))) ctx.addIssue({ code: "custom", message: invalidKey });
      else if (limit && values.length > limit.max) ctx.addIssue({ code: "custom", message: limit.key });
    });
}

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
  bio: z
    .string()
    .transform(sanitizeMultiline)
    .refine((value) => charLength(value) <= BIO_MAX, "bioTooLong"),
  city: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => charLength(value) <= CITY_MAX, "cityTooLong")
    .transform((value) => value || null),
  country: z
    .string()
    .transform((value) => sanitizeLine(value).toUpperCase())
    .refine((value) => value === "" || isCountryCode(value), "invalidCountry")
    .transform((value) => value || null),
  engines: catalogList(ENGINE_IDS, "invalidEngine", { max: MAX_ENGINES, key: "tooManyEngines" }),
  favoriteGenres: catalogList(GENRE_IDS, "invalidGenre"),
});

/** Preferencias de la cuenta (por ahora, solo el idioma). */
export const preferencesSchema = z.object({ locale: localeSchema });

/** Foto de perfil tal como llega al servidor (ya recortada y reducida por el navegador). */
export const avatarUploadSchema = z.object({
  file: z
    .instanceof(File, { error: "missing" })
    .refine((file) => file.size > 0, "missing")
    .refine((file) => file.size <= MAX_AVATAR_BYTES, "tooLarge")
    .refine((file) => Object.values(AVATAR_FORMATS).some((format) => format.mime === file.type), "invalid"),
});

/** Seguir / dejar de seguir. */
export const followSchema = z.object({ targetId: z.uuid(), follow: z.boolean() });

/** Códigos de error de la foto de perfil (los traduce la interfaz en «settings.avatar.errors»). */
export const AVATAR_ERROR_KEYS = [
  "missing",
  "tooLarge",
  "invalid",
  "dimensions",
  "animated",
  "storage",
  "save",
  "unauthenticated",
] as const;
export type AvatarErrorKey = (typeof AVATAR_ERROR_KEYS)[number];
