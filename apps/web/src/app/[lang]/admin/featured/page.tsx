import { Suspense } from "react";
import { ClearFeaturedButton, FeaturedForm } from "@/components/admin/featured-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { listEligibleFirstGames, listFeaturedPicks, type FeaturedPick } from "@/lib/admin/queries";
import { weekStartOf } from "@/lib/games/featured";

const WEEKS_AHEAD = 8;

export default function AdminFeaturedPage() {
  return (
    <Suspense fallback={<Skeleton className="min-h-svh rounded-3xl" aria-hidden="true" />}>
      <Featured />
    </Suspense>
  );
}

async function Featured() {
  const thisWeek = weekStartOf(new Date());
  const [t, locale, picks, games] = await Promise.all([getTranslations("admin"), getLocale(), listFeaturedPicks(thisWeek), listEligibleFirstGames()]);
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
  const weekLabel = (value: string) => day.format(new Date(`${value}T00:00:00Z`));
  const weeks = Array.from({ length: WEEKS_AHEAD + 1 }, (_, index) => {
    const value = new Date(Date.parse(`${thisWeek}T00:00:00Z`) + index * 7 * 86_400_000).toISOString().slice(0, 10);
    return { value, label: index === 0 ? t("featured.weekCurrent", { date: weekLabel(value) }) : t("featured.weekOption", { date: weekLabel(value) }) };
  });

  const row = (pick: FeaturedPick, removable: boolean) => (
    <li key={pick.week_start} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-card p-4">
      <div className="min-w-0">
        <p className="text-sm text-text-3">
          {pick.week_start === thisWeek ? t("featured.current") : t("featured.weekOf", { date: weekLabel(pick.week_start) })}
        </p>
        {pick.game ? (
          <Link href={`/games/${pick.game.public_id}`} className="font-semibold hover:text-cyan hover:underline">
            {pick.game.title}
          </Link>
        ) : null}
        <p className="text-sm text-text-2">{pick.quote ?? t("featured.noQuote")}</p>
      </div>
      {removable ? <ClearFeaturedButton week={pick.week_start} /> : null}
    </li>
  );

  return (
    <div className="grid gap-8">
      <p className="max-w-[720px] text-text-2">{t("featured.subtitle")}</p>
      <section aria-labelledby="upcoming-title" className="grid gap-3">
        <h2 id="upcoming-title" className="font-display text-xl font-bold">
          {t("featured.upcomingTitle")}
        </h2>
        {picks.upcoming.length > 0 ? <ul className="grid gap-3">{picks.upcoming.map((pick) => row(pick, true))}</ul> : <p className="text-text-2">{t("featured.empty")}</p>}
      </section>
      {picks.previous ? (
        <section aria-labelledby="previous-title" className="grid gap-3">
          <h2 id="previous-title" className="font-display text-xl font-bold">
            {t("featured.previousTitle")}
          </h2>
          <p className="text-sm text-text-3">{t("featured.previousHint")}</p>
          <ul className="grid gap-3">{row(picks.previous, false)}</ul>
        </section>
      ) : null}
      <section aria-labelledby="choose-title" className="grid gap-4 rounded-[28px] border border-white/8 bg-card p-6 sm:p-8">
        <h2 id="choose-title" className="font-display text-xl font-bold">
          {t("featured.formTitle")}
        </h2>
        <FeaturedForm games={games} weeks={weeks} />
      </section>
    </div>
  );
}
