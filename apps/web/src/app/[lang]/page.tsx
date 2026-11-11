import { VisitorHome } from "@/components/home/visitor-home";
import { getLocale, getTranslations } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("meta"), getLocale()]);
  return pageMetadata({ title: t("defaultTitle"), description: t("description"), path: "/", locale, titleIsComplete: true });
}

export default function HomePage() {
  return <VisitorHome />;
}
