/**
 * Reglas del @usuario. Son un ESPEJO de las de la base de datos (`private.is_valid_username`, `private.reserved_usernames` y
 * `private.is_reserved_username`): la base es la que manda y esto solo da feedback inmediato mientras la persona escribe. Un
 * test compara el patrón, la lista de reservados, las marcas y las partes reservadas con las migraciones.
 *
 * Principio: si el nombre está libre y es razonable, se puede usar. No se exigen números ni una forma especial.
 *   · 3 a 30 caracteres
 *   · letras minúsculas (a–z), números, guion bajo y punto
 *   · el punto no puede ir al principio, al final ni repetido
 *   · al menos una letra o un número
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** Forma permitida; es exactamente el patrón de `private.is_valid_username` (sin las dos reglas extra de abajo). */
export const USERNAME_PATTERN = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;

/** Solo nombres que permitirían hacerse pasar por el equipo o por el sistema (los perfiles viven bajo /u/). */
export const RESERVED_USERNAMES: readonly string[] = [
  "admin", "administrator", "administrador", "root", "system", "sistema", "tradfal", "trafal", "staff",
  "soporte", "support", "help", "ayuda", "moderator", "moderador", "mod", "api", "www", "null",
  "undefined", "anonymous", "anonimo", "me",
];

/** Nombres del sitio: ningún @usuario puede contenerlos. */
export const RESERVED_BRANDS: readonly string[] = ["tradfal", "trafal"];

/** Partes (separadas por «.» o «_») que dicen «soy del equipo»: ningún @usuario puede tener una. */
export const RESERVED_NAME_PARTS: readonly string[] = [
  "admin", "administrator", "administrador", "moderator", "moderador", "mod", "soporte", "support", "staff", "equipo", "team",
];

/** ¿Está reservado? (exacto, con el nombre del sitio adentro, o con una parte que lo hace pasar por el equipo). */
export function isReservedUsername(username: string): boolean {
  return (
    RESERVED_USERNAMES.includes(username) ||
    RESERVED_BRANDS.some((brand) => username.includes(brand)) ||
    username.split(/[._]/).some((part) => RESERVED_NAME_PARTS.includes(part))
  );
}

export type UsernameFormat = "ok" | "invalid" | "reserved";

/**
 * Lo deja en la forma que se guarda: sin espacios en los bordes, en minúsculas y SIN acentos
 * («  Sofía_Dev » → «sofia_dev»; «ñandú» → «nandu»). Así quien escribe con acentos no recibe un rechazo por algo
 * que se arregla solo, y no hay dos cuentas que solo se distingan por un acento.
 */
export function normalizeUsername(input: string): string {
  return input.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

/** ¿Tiene una forma válida? (ignora si está reservado u ocupado). */
export function isValidUsernameShape(username: string): boolean {
  return USERNAME_PATTERN.test(username) && !username.includes("..") && /[a-z0-9]/.test(username);
}

export function checkUsernameFormat(input: string): UsernameFormat {
  const username = normalizeUsername(input);
  if (!isValidUsernameShape(username)) return "invalid";
  if (isReservedUsername(username)) return "reserved";
  return "ok";
}

export type UsernameProblem = "tooShort" | "tooLong" | "characters" | "dots" | "noLetters";

/**
 * Por qué un nombre no es válido, para mostrar un mensaje útil en vez de «las reglas de abajo». `null` si la forma es
 * correcta o está vacío. Recibe el nombre YA normalizado.
 */
export function usernameProblem(normalized: string): UsernameProblem | null {
  if (!normalized || isValidUsernameShape(normalized)) return null;
  if (/[^a-z0-9_.]/.test(normalized)) return "characters";
  if (normalized.length < USERNAME_MIN) return "tooShort";
  if (normalized.length > USERNAME_MAX) return "tooLong";
  if (normalized.startsWith(".") || normalized.endsWith(".") || normalized.includes("..")) return "dots";
  return "noLetters";
}

const SUFFIXES = ["_dev", "_games", "_makes", "_plays", ".codes"] as const;
const PREFIXES = ["the_", "its_"] as const;

/**
 * Alternativas para un nombre ocupado. Sin números a propósito (nadie tiene que "agregarles un 2"): se arman
 * con palabras del mundo de hacer juegos. Devuelve solo las que tienen una forma válida; quien llama revisa
 * cuáles están libres.
 */
export function suggestUsernames(taken: string): string[] {
  const base = normalizeUsername(taken);
  if (!base) return [];
  return [...SUFFIXES.map((suffix) => base + suffix), ...PREFIXES.map((prefix) => prefix + base)].filter(
    (candidate) => checkUsernameFormat(candidate) === "ok",
  );
}
