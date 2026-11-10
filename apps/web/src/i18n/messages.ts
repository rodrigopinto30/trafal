import "server-only";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { Locale } from "./config";
import type { Messages, Namespace } from "./translator";

// Si en.json no tiene exactamente la misma forma que es.json, esta asignación no compila.
const dictionaries: Record<Locale, Messages> = { es, en };

export function getMessagesFor(locale: Locale): Messages {
  return dictionaries[locale];
}

/**
 * Namespaces que viajan al navegador en TODAS las páginas (el resto de los textos se resuelve en el servidor y no suma peso).
 * Los demás los pide cada página con <ExtraMessages>: así una pantalla pública no carga los textos de los formularios.
 * Un componente de cliente solo puede usar los de acá o los que su página pidió.
 */
export const BASE_CLIENT_NAMESPACES = ["common", "nav", "errors", "search", "profile", "reactions", "share", "postForm", "report"] as const satisfies readonly Namespace[];

/** Todos los namespaces que algún componente de cliente puede necesitar (los de la base más los que piden algunas páginas). */
export const CLIENT_NAMESPACES = [
  ...BASE_CLIENT_NAMESPACES,
  "auth",
  "onboarding",
  "settings",
  "engines",
  "genres",
  "gameForm",
  "gamePlayer",
  "gameVersions",
  "comments",
  "admin",
  "notifications",
] as const satisfies readonly Namespace[];

export type ClientNamespace = (typeof CLIENT_NAMESPACES)[number];

export function pickClientMessages(messages: Messages, namespaces: readonly ClientNamespace[] = BASE_CLIENT_NAMESPACES): Partial<Messages> {
  const picked: Record<string, unknown> = {};
  for (const namespace of namespaces) picked[namespace] = messages[namespace];
  return picked as Partial<Messages>;
}
