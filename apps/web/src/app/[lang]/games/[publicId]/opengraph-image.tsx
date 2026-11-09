import { findGameByPublicId } from "@/lib/games/queries";
import { OG_CONTENT_TYPE, OG_SIZE, ogLocale, ogTexts, renderCard } from "@/lib/seo/og-card";
import { parsePublicIdParam } from "@/lib/validation/common";
import { getMessagesFor } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translator";

export const alt = "Trafal";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ lang: string; publicId: string }> }) {
  const { lang, publicId: rawPublicId } = await params;
  const locale = ogLocale(lang);
  const publicId = parsePublicIdParam(rawPublicId);
  const game = publicId ? await findGameByPublicId(publicId) : null;
  const t = ogTexts(locale);
  if (!game) return renderCard({ title: t("tagline"), footer: t("playFree"), footerTone: "play" });

  const messages = getMessagesFor(locale);
  const genres = createTranslator(messages, locale, "genres");
  const engines = createTranslator(messages, locale, "engines");
  const kicker = [game.genre_id ? genres(game.genre_id as Parameters<typeof genres>[0]) : null, game.engine_id ? engines(game.engine_id as Parameters<typeof engines>[0]) : null].filter(Boolean).join(" · ");
  return renderCard({ kicker, title: game.title, subtitle: t("byAuthor", { name: game.owner.display_name }), footer: t("playFree"), footerTone: "play" });
}
