import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";

type Section = "explore" | "creators" | "upload";

/** Pantalla provisoria de una sección que se construye en una fase posterior. */
export async function ComingSoon({ section }: { section: Section }) {
  const t = await getTranslations("comingSoon");
  return (
    <section className="mx-auto max-w-[720px] px-5 pt-20 text-center">
      <Badge variant="cyan">{t("badge")}</Badge>
      <h1 className="mt-5 font-display text-[clamp(32px,5vw,46px)] leading-[1.1] font-bold text-glow-violet">{t(`${section}.title`)}</h1>
      <p className="mx-auto mt-4 max-w-[560px] text-lg text-text-2">{t(`${section}.description`)}</p>
      <p className="mt-2 text-text-3">{t("text")}</p>
      <Button asChild variant="outline" size="lg" className="mt-8">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </section>
  );
}
