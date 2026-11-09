import { OG_CONTENT_TYPE, OG_SIZE, ogLocale, ogTexts, renderCard } from "@/lib/seo/og-card";

export const alt = "Trafal";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const t = ogTexts(ogLocale((await params).lang));
  return renderCard({ title: t("tagline"), footer: t("playFree"), footerTone: "play" });
}
