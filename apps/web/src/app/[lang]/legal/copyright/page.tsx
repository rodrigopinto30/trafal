import { LegalDraft } from "@/components/layout/legal-draft";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("legal"), getLocale()]);
  return pageMetadata({ title: t("copyright"), description: t("draftText"), path: "/legal/copyright", locale });
}

export default async function Page() {
  const t = await getTranslations("claims");
  return (
    <>
      <LegalDraft document="copyright" />
      <div className="mx-auto max-w-[760px] px-5 pt-6">
        <Button asChild size="lg">
          <Link href="/legal/copyright/claim">{t("linkFromLegal")}</Link>
        </Button>
      </div>
    </>
  );
}
