import "server-only";
import { lang } from "next/root-params";
import { type Locale, defaultLocale, isLocale } from "./config";
import { getMessagesFor } from "./messages";
import { createTranslator, type Messages, type Namespace, type Translator } from "./translator";

/**
 * Idioma de la página actual, leído del segmento raíz [lang] (sin pasar por headers(), así el
 * caparazón estático de Cache Components sigue siendo estático). Solo en Server Components.
 *
 * El proxy solo deja pasar «es» y «en» (cualquier otra cosa se trata como parte de la ruta y da 404), así que
 * un valor distinto no se da en tráfico real. Se cae al idioma por defecto en vez de lanzar notFound(): lanzar
 * en el layout raíz lo «descarta» y rompe la validación de navegación instantánea de Next en desarrollo.
 */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : defaultLocale;
}

/** Traductor de un namespace para Server Components. */
export async function getTranslations<N extends Namespace>(namespace: N): Promise<Translator<Messages[N]>> {
  const locale = await getLocale();
  return createTranslator(getMessagesFor(locale), locale, namespace);
}

/** Traductor para Server Actions y Route Handlers, donde no hay segmento raíz: el idioma se pasa a mano. */
export function getTranslationsFor<N extends Namespace>(locale: Locale, namespace: N): Translator<Messages[N]> {
  return createTranslator(getMessagesFor(locale), locale, namespace);
}
