import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("deleted.title"), robots: { index: false } };
}

export default async function AccountDeletedPage() {
  const t = await getTranslations("settings");
  return (
    <div className="mx-auto grid max-w-[560px] justify-items-center gap-4 px-5 pt-[clamp(48px,10vw,120px)] text-center">
      <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight font-bold text-glow-violet">{t("deleted.title")}</h1>
      <p className="text-text-2">{t("deleted.text")}</p>
      <Button asChild size="lg">
        <Link href="/">{t("deleted.home")}</Link>
      </Button>
    </div>
  );
}
