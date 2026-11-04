import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <section className="mx-auto max-w-[640px] px-5 pt-24 text-center">
      <p className="pixel-label text-[13px] text-coral">404</p>
      <h1 className="mt-3 font-display text-4xl font-bold text-glow-violet">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-lg text-text-2">{t("notFoundText")}</p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </section>
  );
}
