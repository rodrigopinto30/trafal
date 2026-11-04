"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <section className="mx-auto max-w-[640px] px-5 pt-24 text-center">
      <h1 className="font-display text-4xl font-bold text-glow-violet">{t("unexpectedTitle")}</h1>
      <p className="mt-3 text-lg text-text-2">{t("unexpectedText")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          {t("retry")}
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    </section>
  );
}
