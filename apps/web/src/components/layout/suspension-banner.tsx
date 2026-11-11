import { ShieldAlertIcon } from "lucide-react";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { getMySuspension } from "@/lib/auth/dal";

/** Tells a suspended person, on every page, that their account is suspended, why and until when. Shows nothing to anyone else. */
export async function SuspensionBanner() {
  const suspension = await getMySuspension();
  if (!suspension) return null;
  const [t, locale] = await Promise.all([getTranslations("suspension"), getLocale()]);
  const until = suspension.until ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(suspension.until)) : null;

  return (
    <section role="status" aria-label={t("title")} className="border-b border-coral/40 bg-coral/10 px-5 py-3">
      <div className="mx-auto flex max-w-[1100px] items-start gap-3">
        <ShieldAlertIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-coral" />
        <div className="grid gap-0.5 text-sm text-text-2">
          <p className="font-semibold text-foreground">
            {t("title")}. {until ? t("untilDate", { date: until }) : t("untilFurtherNotice")}
          </p>
          {suspension.reason ? <p className="break-words whitespace-pre-line">{t("reason", { reason: suspension.reason })}</p> : null}
          <p>{t("text")}</p>
          <p>
            <Link href="/settings/moderation" className="font-semibold text-cyan underline underline-offset-2 hover:text-white">
              {t("appealLink")}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
