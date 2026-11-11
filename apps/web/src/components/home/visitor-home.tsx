import { ArrowRightIcon } from "lucide-react";
import { Suspense } from "react";
import { LandingGames } from "@/components/home/landing-games";
import { SurpriseButton } from "@/components/games/surprise-button";
import { LandingSkeleton } from "@/components/home/landing-skeleton";
import { GameSearch } from "@/components/search/game-search";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { JsonLd } from "@/components/seo/json-ld";
import { webSiteData } from "@/lib/seo/structured-data";

/** The public home: what a visitor sees at «/» (static, it never reads the session). Also the fallback of the signed-in home when there turns out to be no valid session. */
export async function VisitorHome() {
  const [t, tMeta, locale] = await Promise.all([getTranslations("home"), getTranslations("meta"), getLocale()]);

  const steps = [
    { n: "01", key: "upload", bg: "bg-brand-diag" },
    { n: "02", key: "share", bg: "bg-linear-to-br from-cyan to-lime" },
    { n: "03", key: "feedback", bg: "bg-linear-to-br from-coral to-[#ffb067]" },
  ] as const;

  return (
    <>
      <JsonLd data={webSiteData(locale, tMeta("description"))} />
      <section className="mx-auto max-w-[980px] px-5 pt-[clamp(40px,6vw,72px)] text-center">
        <h1 className="font-display text-[clamp(36px,5.8vw,62px)] leading-[1.04] font-bold tracking-tight text-glow-violet">
          {t("titleLead")} <span className="text-gradient">{t("titleAccent")}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-[620px] text-lg text-text-2">{t("subtitle")}</p>

        <div className="mt-8">
          <GameSearch variant="hero" />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3 max-sm:flex-col">
          <Button size="lg" asChild className="shadow-[0_0_24px_rgb(139_92_255/0.6),0_0_52px_rgb(46_230_255/0.22)]">
            <Link href="/signup">
              {t("ctaSignup")}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/games/new">{t("ctaUpload")}</Link>
          </Button>
          <SurpriseButton size="lg" />
        </div>
      </section>

      <Suspense fallback={<LandingSkeleton />}>
        <LandingGames />
      </Suspense>

      <section className="mx-auto max-w-[1200px] px-5 pt-[clamp(80px,10vw,120px)]">
        <div className="max-w-[680px]">
          <p className="pixel-label text-[13px] text-cyan text-glow-cyan">{t("howLabel")}</p>
          <h2 className="mt-3 font-display text-[clamp(30px,5vw,46px)] leading-[1.1] font-bold text-glow-violet">{t("howTitle")}</h2>
        </div>

        <ol className="mt-10 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
          {steps.map((step) => (
            <li
              key={step.key}
              data-n={step.n}
              // El número gigante de fondo es decoración pura: va en un pseudo-elemento (no es texto del documento).
              className="relative overflow-hidden rounded-3xl border border-white/8 bg-[rgb(20_18_38/0.66)] p-7 transition-shadow duration-200 before:pointer-events-none before:absolute before:top-1.5 before:right-[18px] before:font-display before:text-[72px] before:font-bold before:text-white/5 before:content-[attr(data-n)] hover:shadow-card-hover"
            >
              <span
                aria-hidden="true"
                className={`grid size-[52px] place-items-center rounded-2xl font-display text-lg font-extrabold text-ink ${step.bg}`}
              >
                {step.n}
              </span>
              <h3 className="mt-5 mb-2 font-display text-[21px] font-bold">{t(`steps.${step.key}.title`)}</h3>
              <p className="text-text-2">{t(`steps.${step.key}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pt-[clamp(80px,10vw,120px)]">
        <div className="relative overflow-hidden rounded-[32px] border border-cyan/45 bg-linear-to-br from-[#2a1670] via-[#1a1250] to-[#0b2f45] px-5 py-14 text-center shadow-[0_0_30px_rgb(139_92_255/0.35),0_0_80px_rgb(46_230_255/0.12),inset_0_0_40px_rgb(46_230_255/0.08)] sm:px-10 sm:py-16">
          <span aria-hidden="true" className="absolute inset-0 bg-dots bg-[length:18px_18px]" />
          <div className="relative">
            <h2 className="mx-auto max-w-[820px] font-display text-[clamp(30px,5.4vw,52px)] leading-[1.08] font-bold [text-shadow:0_0_28px_rgb(46_230_255/0.45)]">
              {t("finalTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-[560px] text-lg text-[#dcd3ff]">{t("finalText")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 max-sm:flex-col">
              <Button size="xl" variant="secondary" asChild className="shadow-[0_0_24px_rgb(255_255_255/0.35)]">
                <Link href="/signup">{t("ctaSignup")}</Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link href="/games/new">{t("ctaUpload")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
