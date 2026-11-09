import type { ReactNode } from "react";
import { I18nExtend } from "@/i18n/client";
import { getMessagesFor, pickClientMessages, type ClientNamespace } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";

/** Sends the browser the texts of these namespaces for the page inside it (the ones every page has are already there). */
export async function ExtraMessages({ namespaces, children }: { namespaces: readonly ClientNamespace[]; children: ReactNode }) {
  const locale = await getLocale();
  return <I18nExtend messages={pickClientMessages(getMessagesFor(locale), namespaces)}>{children}</I18nExtend>;
}
