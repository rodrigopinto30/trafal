import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { FEED_KINDS, FEED_SCOPES, feedHref, type FeedQuery } from "@/lib/validation/feed";
import { cn } from "@/lib/utils";

const PILL = "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-text-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyan";
const ACTIVE = "bg-white/10 text-foreground";

/** Filters of the feed as links (the view lives in the address, so it can be shared and the back button works): by type, and for people with an account, everyone or only who they follow. */
export async function FeedFilters({ query, signedIn }: { query: FeedQuery; signedIn: boolean }) {
  const t = await getTranslations("feed");
  return (
    <div className="grid gap-3">
      {signedIn ? (
        <nav aria-label={t("scopesLabel")}>
          <ul className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-white/8 bg-[rgb(20_18_38/0.8)] p-1">
            {FEED_SCOPES.map((scope) => (
              <li key={scope}>
                <Link href={feedHref({ kind: query.kind, scope, before: null })} aria-current={query.scope === scope ? "page" : undefined} className={cn(PILL, query.scope === scope && ACTIVE)}>
                  {t(`scopes.${scope}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <nav aria-label={t("kindsLabel")}>
        <ul className="flex flex-wrap gap-2">
          {FEED_KINDS.map((kind) => (
            <li key={kind}>
              <Link
                href={feedHref({ kind, scope: query.scope, before: null })}
                aria-current={query.kind === kind ? "page" : undefined}
                className={cn(PILL, "border border-white/10", query.kind === kind && ACTIVE)}
              >
                {t(`kinds.${kind}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
