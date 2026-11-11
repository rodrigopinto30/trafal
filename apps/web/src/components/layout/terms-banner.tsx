import { ScrollTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { hasOutdatedTerms } from "@/lib/auth/dal";

/** Tells someone who accepted an older version of the terms, on every page, to accept the current one. Shows nothing to anyone else. */
export async function TermsBanner() {
  if (!(await hasOutdatedTerms())) return null;
  const t = await getTranslations("terms");

  return (
    <section role="status" aria-label={t("title")} className="border-b border-cyan/40 bg-cyan/10 px-5 py-3">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2">
        <ScrollTextIcon aria-hidden="true" className="size-5 shrink-0 text-cyan" />
        <p className="flex-1 text-sm text-text-2">{t("banner.text")}</p>
        <Button asChild variant="outline">
          <Link href="/accept-terms">{t("banner.action")}</Link>
        </Button>
      </div>
    </section>
  );
}
