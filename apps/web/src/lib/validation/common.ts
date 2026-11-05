import { z } from "zod";
import { defaultLocale, locales } from "@/i18n/config";
import { isInternalPath } from "@/i18n/path";
import { isValidUsernameShape, normalizeUsername } from "@/lib/username";

/**
 * Esquemas de Zod que se usan en más de un lugar. TODO dato que llega del navegador (campos de formularios,
 * parámetros de la URL, argumentos de Server Actions) se parsea con uno de estos esquemas antes de usarse: el
 * navegador no es de fiar, así que la validación real vive acá, en el servidor. Los formularios de cliente
 * reutilizan las mismas reglas para avisar antes de enviar.
 */

export const localeSchema = z.enum(locales);

/** Idioma de un campo oculto «lang». Si falta o viene raro, se usa el idioma por defecto. */
export function parseLocale(value: unknown) {
  const result = localeSchema.safeParse(value);
  return result.success ? result.data : defaultLocale;
}

/** Ruta interna del sitio (destino de ?next=). Evita redirecciones abiertas a otros dominios. */
const nextPathSchema = z.string().max(2048).refine(isInternalPath);

/** Devuelve la ruta si es interna y segura; si no, null. */
export function parseNextPath(value: unknown): string | null {
  const result = nextPathSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Los searchParams de Next pueden venir como string o lista (?x=1&x=2): nos quedamos con el primero. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Errores que puede traer ?error= en /login. Cualquier otro valor se ignora. */
const loginErrorSchema = z.enum(["linkExpired", "oauthFailed"]);

export function parseLoginError(value: unknown) {
  const result = loginErrorSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

/**
 * El @usuario de la URL (/u/<usuario>). Un percent-encoding roto («%E0%A4%A») haría lanzar a decodeURIComponent;
 * un valor con forma imposible no puede existir. En ambos casos devuelve null y la página responde 404 sin consultar la base.
 */
export function parseUsernameParam(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const username = normalizeUsername(decoded);
  return isValidUsernameShape(username) ? username : null;
}

const publicIdSchema = z
  .string()
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export function parsePublicIdParam(value: string): string | null {
  const result = publicIdSchema.safeParse(value);
  return result.success ? result.data : null;
}
