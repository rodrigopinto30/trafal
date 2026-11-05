import { z } from "zod";
import { charLength, sanitizeLine } from "./text";

export const SEARCH_QUERY_MAX = 80;
export const SUGGESTION_MIN_LENGTH = 2;

const searchQuerySchema = z
  .string()
  .transform((value) => Array.from(sanitizeLine(value)).slice(0, SEARCH_QUERY_MAX).join(""))
  .refine((value) => charLength(value) >= 1);

/** Texto de búsqueda ya saneado y recortado a 80 caracteres, o null si viene vacío o no es texto. */
export function parseSearchQuery(value: unknown): string | null {
  const result = searchQuerySchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Igual que parseSearchQuery, pero exige el largo mínimo de las sugerencias en vivo (con una sola letra serían ruido). */
export function parseSuggestionQuery(value: unknown): string | null {
  const query = parseSearchQuery(value);
  return query !== null && charLength(query) >= SUGGESTION_MIN_LENGTH ? query : null;
}
