import type { ZodError } from "zod";

/**
 * Saneado de texto que viene del navegador. Todo lo que escribe una persona pasa por acá (vía los esquemas de Zod)
 * ANTES de validarse o guardarse. La salida siempre es texto plano: React lo escapa al mostrarlo y la base lo guarda
 * tal cual, así que no hace falta (ni se permite) HTML.
 *
 * Qué se saca:
 *   · caracteres de control (menos el salto de línea en textos largos);
 *   · caracteres invisibles que sirven para falsificar nombres: espacio de ancho cero, word joiner, BOM, guion
 *     opcional, rellenos de Hangul, marcas y controles de «dirección de escritura» (RLO/LRO, aislados, LRM/RLM/ALM),
 *     que permiten que «Admin» se vea como «nimdA»;
 *   · espacios repetidos o sobrantes.
 * Qué NO se saca: el pegamento de emojis (ZWJ), ZWNJ ni los selectores de variante, porque romperían 👨‍👩‍👧 o textos
 * en persa. La base rechaza exactamente lo que acá se saca (private.has_hidden_chars; un test los mantiene iguales).
 * Antes de limpiar, el texto se corta en RAW_TEXT_MAX: así un texto enorme no cuesta nada y falla igual por largo.
 */

export const RAW_TEXT_MAX = 50_000;

const INVISIBLE_OR_BIDI =
  /[\u00AD\u061C\u115F\u1160\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\u3164\uFEFF\uFFA0]/g;
// Controles C0 y C1 (incluido \n, \t y \r), más los separadores de línea/párrafo de Unicode.
const CONTROL_OR_LINE_SEPARATOR = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
// Igual, pero dejando pasar \n (U+000A): en los textos largos se conservan los saltos de línea.
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;

function bounded(input: string): string {
  return input.length > RAW_TEXT_MAX ? input.slice(0, RAW_TEXT_MAX) : input;
}

/** Texto de una sola línea: sin saltos, con los espacios normalizados y sin espacios en los bordes. */
export function sanitizeLine(input: string): string {
  return bounded(input)
    .normalize("NFC")
    .replace(INVISIBLE_OR_BIDI, "")
    .replace(CONTROL_OR_LINE_SEPARATOR, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto de varias líneas (bio, comentarios): conserva los saltos, pero como mucho una línea en blanco seguida. */
export function sanitizeMultiline(input: string): string {
  return bounded(input)
    .normalize("NFC")
    .replace(/\r\n?|\u2028|\u2029/g, "\n")
    .replace(INVISIBLE_OR_BIDI, "")
    .replace(CONTROL_EXCEPT_NEWLINE, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Cantidad de caracteres como los cuenta Postgres (`char_length`: puntos de código). `string.length` cuenta unidades
 * UTF-16, así que un emoji valdría 2 y se rechazaría un texto que la base sí acepta.
 */
export function charLength(value: string): number {
  return Array.from(value).length;
}

/** Cantidad de bytes en UTF-8 (bcrypt, el algoritmo de las contraseñas, solo mira los primeros 72). */
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Quita repetidos conservando el orden. */
export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/**
 * Convierte los errores de Zod en `{ campo: mensaje traducido }`. En los esquemas, el `message` de cada regla es
 * una CLAVE de traducción (p. ej. "weakPassword"). Si llegara un mensaje que no es una de las claves esperadas
 * (por ejemplo el texto en inglés que Zod genera cuando falta un campo), se usa `fallback`: nunca se le muestra a
 * la persona un texto técnico.
 */
export function fieldErrorsFrom<K extends string>(
  error: ZodError,
  keys: readonly K[],
  translate: (key: K) => string,
  fallback: K,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (field in out) continue; // un solo error por campo: el primero
    const key = (keys as readonly string[]).includes(issue.message) ? (issue.message as K) : fallback;
    out[field] = translate(key);
  }
  return out;
}
