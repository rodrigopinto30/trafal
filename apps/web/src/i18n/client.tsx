"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { createTranslator, type Messages, type Namespace, type Translator } from "./translator";

type I18nValue = { locale: Locale; messages: Partial<Messages> };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Partial<Messages>;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

/** Adds the texts of more namespaces for the pages below it (the page that needs them), on top of the ones every page already has. */
export function I18nExtend({ messages, children }: { messages: Partial<Messages>; children: ReactNode }) {
  const parent = useContext(I18nContext);
  const value = useMemo(() => (parent ? { locale: parent.locale, messages: { ...parent.messages, ...messages } } : null), [parent, messages]);
  if (!value) throw new Error("I18nExtend debe usarse dentro de <I18nProvider>");
  return <I18nContext value={value}>{children}</I18nContext>;
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useTranslations/useLocale deben usarse dentro de <I18nProvider>");
  return value;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** Traductor para Componentes de Cliente. El namespace tiene que estar en CLIENT_NAMESPACES. */
export function useTranslations<N extends Namespace>(namespace: N): Translator<Messages[N]> {
  const { locale, messages } = useI18n();
  if (process.env.NODE_ENV !== "production" && messages[namespace] === undefined) {
    throw new Error(`Los textos «${namespace}» no llegaron a esta pantalla: agregalos en BASE_CLIENT_NAMESPACES o envolvé la página en <ExtraMessages namespaces={["${namespace}"]}>`);
  }
  return useMemo(() => createTranslator(messages as Messages, locale, namespace), [locale, messages, namespace]);
}
