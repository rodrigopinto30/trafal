import { ClaimForm } from "@/components/claims/claim-form";
import { ExtraMessages } from "@/components/i18n/extra-messages";
import { getLocale, getTranslations } from "@/i18n/server";
import { publicEnv } from "@/lib/env";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("claims"), getLocale()]);
  return pageMetadata({ title: t("title"), description: t("subtitle"), path: "/legal/copyright/claim", locale });
}

export default async function CopyrightClaimPage() {
  const t = await getTranslations("claims");
  return (
    <ExtraMessages namespaces={["claims"]}>
      <div className="mx-auto grid w-full max-w-[760px] grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-[clamp(32px,5vw,56px)]">
        <header>
          <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
          <p className="mt-3 text-text-2">{t("subtitle")}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-2">
            <li>{t("noteAccount")}</li>
            <li>{t("notePrivacy")}</li>
          </ul>
        </header>
        <ClaimForm example={`${publicEnv.siteUrl.replace(/\/$/, "")}/games/<id>`} />
      </div>
    </ExtraMessages>
  );
}
