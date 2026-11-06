import { Badge } from "@/components/ui/badge";
import { getLocale, getTranslations } from "@/i18n/server";
import { formatRelativeTime } from "@/lib/format";
import type { PublicVersion } from "@/lib/games/queries";

/** The «Versions» section of a game's page: its ready versions, newest first, with the current one marked and each changelog. */
export async function VersionList({ versions, activeVersionId }: { versions: PublicVersion[]; activeVersionId: string | null }) {
  const [t, locale] = await Promise.all([getTranslations("games"), getLocale()]);
  const now = new Date();
  return (
    <section aria-labelledby="versions-heading" className="grid gap-4">
      <h2 id="versions-heading" className="font-display text-2xl font-bold">
        {t("versions.title")}
      </h2>
      <ul className="grid gap-3">
        {versions.map((version) => (
          <li key={version.id} className="grid gap-2 rounded-3xl border border-white/8 bg-card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-lg font-bold">{version.label}</h3>
              {version.id === activeVersionId ? <Badge variant="cyan">{t("versions.current")}</Badge> : null}
              {version.processed_at ? <span className="text-sm text-text-3">{t("versions.published", { when: formatRelativeTime(locale, version.processed_at, now) })}</span> : null}
            </div>
            <p className="text-sm whitespace-pre-line text-text-2">{version.changelog || t("versions.noChangelog")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
