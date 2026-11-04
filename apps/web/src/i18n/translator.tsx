import { Fragment, createElement, type ReactNode } from "react";
import type { Locale } from "./config";
import { formatMessage, formatRich, type TagRenderers, type Values } from "./format";
import type messagesEs from "@/messages/es.json";

/** La forma de los mensajes la define el español (es.json); en.json debe tener exactamente las mismas claves. */
export type Messages = typeof messagesEs;

/** Claves de hoja con punto: { a: { b: "x" } } → "a.b". */
export type Leaves<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : { [K in keyof T & string]: Leaves<T[K], Prefix extends "" ? K : `${Prefix}.${K}`> }[keyof T & string];

export type Namespace = keyof Messages & string;
export type RichTags = TagRenderers<ReactNode>;

export type Translator<M> = {
  (key: Leaves<M>, values?: Values): string;
  /** Mensaje con etiquetas, p. ej. «Aceptás los <terms>Términos</terms>». */
  rich(key: Leaves<M>, values?: Values, tags?: RichTags): ReactNode;
};

function lookup(messages: unknown, path: string): string | undefined {
  let node: unknown = messages;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Traductor de un espacio de nombres. Si una clave falta (no debería: hay un test de paridad es/en),
 * devuelve la clave misma para que el error sea visible sin romper la página.
 */
export function createTranslator<N extends Namespace>(
  messages: Messages,
  locale: Locale,
  namespace: N,
): Translator<Messages[N]> {
  const scoped = messages[namespace];

  const resolve = (key: string): string => {
    const found = lookup(scoped, key);
    if (found === undefined) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[i18n] Falta la traducción «${namespace}.${key}» (${locale})`);
      }
      return `${namespace}.${key}`;
    }
    return found;
  };

  const translate = (key: string, values?: Values): string => formatMessage(resolve(key), locale, values);

  const rich = (key: string, values?: Values, tags?: RichTags): ReactNode => {
    const chunks = formatRich<ReactNode>(resolve(key), locale, values, tags);
    return createElement(Fragment, null, ...chunks.map((chunk, index) => createElement(Fragment, { key: index }, chunk)));
  };

  // La firma pública exige claves válidas del namespace (Leaves<...>); por dentro basta con string.
  return Object.assign(translate, { rich }) as unknown as Translator<Messages[N]>;
}
