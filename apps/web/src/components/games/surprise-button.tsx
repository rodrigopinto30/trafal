import { DicesIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getLocale, getTranslations } from "@/i18n/server";
import { surpriseHref } from "@/lib/validation/surprise";
import { cn } from "@/lib/utils";

type Props = { exclude?: string; variant?: "outline" | "ghost"; size?: "default" | "lg"; className?: string };

/**
 * «Surprise me»: a link to a random published game. It is a plain link and not the router's one on purpose: it must not be
 * prefetched (each visit picks again) and it works without JavaScript.
 */
export async function SurpriseButton({ exclude, variant = "outline", size = "default", className }: Props) {
  const [t, locale] = await Promise.all([getTranslations("surprise"), getLocale()]);
  return (
    <a href={surpriseHref(locale, exclude)} title={t("hint")} className={cn(buttonVariants({ variant, size }), className)}>
      <DicesIcon aria-hidden="true" />
      {t("label")}
    </a>
  );
}
