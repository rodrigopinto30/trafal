import { LegalDocument } from "@/components/legal/legal-document";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { legalMetadata } from "@/lib/legal/metadata";

export async function generateMetadata() {
  return legalMetadata("copyright", "/legal/copyright");
}

export default async function Page() {
  const t = await getTranslations("claims");
  return (
    <>
      <LegalDocument id="copyright" />
      <div className="mx-auto max-w-[760px] px-5 pb-8">
        <Button asChild size="lg">
          <Link href="/legal/copyright/claim">{t("linkFromLegal")}</Link>
        </Button>
      </div>
    </>
  );
}
