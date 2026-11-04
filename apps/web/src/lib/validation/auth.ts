import { z } from "zod";
import { byteLength, sanitizeLine } from "./text";

/**
 * Esquemas de los formularios de acceso. El `message` de cada regla es una CLAVE de «auth.errors» (no un texto):
 * la Server Action la traduce al idioma de la persona con `fieldErrorsFrom`.
 */
export const AUTH_FORM_ERROR_KEYS = [
  "required",
  "invalidEmail",
  "weakPassword",
  "passwordsDontMatch",
  "consentRequired",
  "generic",
] as const;
export type AuthFormErrorKey = (typeof AUTH_FORM_ERROR_KEYS)[number];

/** Email en minúsculas y sin espacios ni caracteres invisibles. 254 es el máximo que admite el estándar. */
export const emailSchema = z
  .string()
  .transform((value) => sanitizeLine(value).toLowerCase())
  .pipe(z.email("invalidEmail").max(254, "invalidEmail"));

/**
 * Contraseña: 8 a 72 BYTES, con letras y números (lo mismo que exige Supabase Auth: auth.password_requirements).
 * Se cuentan bytes y no caracteres porque bcrypt ignora lo que pase de 72 bytes: una contraseña con acentos o
 * emojis llegaría a ese límite antes de los 72 caracteres. A propósito NO se recorta ni se normaliza: lo que
 * escribe la persona es lo que se guarda.
 */
export const passwordSchema = z
  .string()
  .min(8, "weakPassword")
  .refine((value) => byteLength(value) <= 72, "weakPassword")
  .regex(/[A-Za-z]/, "weakPassword")
  .regex(/\d/, "weakPassword");

const passwordsMatch = (data: { password: string; confirm: string }, ctx: z.RefinementCtx) => {
  if (data.password !== data.confirm) {
    ctx.addIssue({ code: "custom", message: "passwordsDontMatch", path: ["confirm"] });
  }
};

export const loginSchema = z.object({
  email: emailSchema,
  // Al iniciar sesión no se valida la fortaleza (la cuenta puede ser anterior a la regla): solo que haya algo.
  password: z.string().min(1, "required").max(1024, "required"),
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string().min(1, "required"),
    /** Casilla «tengo 18 años o más y acepto los términos». */
    consent: z.boolean().refine((checked) => checked, "consentRequired"),
  })
  .superRefine(passwordsMatch);

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string().min(1, "required") })
  .superRefine(passwordsMatch);

/** Tipos de link que manda Supabase Auth por mail (los que acepta /auth/confirm). */
export const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;

/** Query de /auth/confirm: token_hash es opaco (lo valida Supabase); acá solo se acota su forma. */
export const confirmQuerySchema = z.object({
  token_hash: z.string().min(8).max(512),
  type: z.enum(OTP_TYPES),
});

/** Query de /auth/callback (OAuth con PKCE): el código es opaco; se acota su forma. */
export const oauthCallbackQuerySchema = z.object({ code: z.string().min(8).max(2048) });
