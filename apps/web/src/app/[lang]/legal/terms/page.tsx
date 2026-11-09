import { LegalDraft } from "@/components/layout/legal-draft";
import { getLocale, getTranslations } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("legal"), getLocale()]);
  return pageMetadata({ title: t("terms"), description: t("draftText"), path: "/legal/terms", locale });
}

export default function Page() {
  return <LegalDraft document="terms" />;
}
