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
 * Namespaces que viajan al navegador. Los componentes de cliente solo pueden usar estos; el resto
 * de los textos se resuelve en el servidor y no suma peso al JS. Si un componente de cliente necesita
 * un namespace nuevo, se agrega acá.
 */
export const CLIENT_NAMESPACES = [
  "common",
  "nav",
  "auth",
  "onboarding",
  "profile",
  "settings",
  "engines",
  "genres",
  "search",
  "uploadErrors",
  "gameForm",
  "gamePlayer",
  "gameVersions",
  "reactions",
  "postForm",
  "comments",
  "share",
  "errors",
] as const satisfies readonly Namespace[];

export function pickClientMessages(messages: Messages): Partial<Messages> {
  const picked: Record<string, unknown> = {};
  for (const namespace of CLIENT_NAMESPACES) picked[namespace] = messages[namespace];
  return picked as Partial<Messages>;
}
