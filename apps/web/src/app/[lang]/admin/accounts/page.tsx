import { Suspense } from "react";
import { AccountActions } from "@/components/admin/account-actions";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { listAccounts } from "@/lib/admin/queries";
import { getAuthUser } from "@/lib/auth/dal";
import { ACCOUNT_FILTERS, ACCOUNT_SEARCH_MAX, parseAccountFilter, parseAccountSearch } from "@/lib/validation/admin";
import { firstParam } from "@/lib/validation/common";

export default function AdminAccountsPage({ searchParams }: PageProps<"/[lang]/admin/accounts">) {
  return (
    <Suspense fallback={<Skeleton className="min-h-svh rounded-3xl" aria-hidden="true" />}>
      <Accounts searchParams={searchParams} />
    </Suspense>
  );
}

async function Accounts({ searchParams }: { searchParams: PageProps<"/[lang]/admin/accounts">["searchParams"] }) {
  const raw = await searchParams;
  const search = parseAccountSearch(firstParam(raw.q));
  const filter = parseAccountFilter(firstParam(raw.filter));
  const [t, locale, me, { accounts, truncated }] = await Promise.all([getTranslations("admin"), getLocale(), getAuthUser(), listAccounts(search, filter)]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <section aria-labelledby="accounts-title" className="grid gap-5">
      <div>
        <h2 id="accounts-title" className="font-display text-2xl font-bold">
          {t("accounts.title")}
        </h2>
        <p className="mt-1 max-w-[720px] text-text-2">{t("accounts.subtitle")}</p>
      </div>

      <form method="get" role="search" className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
        <Field id="accounts-q" label={t("accounts.searchLabel")}>
          {(control) => <Input {...control} type="search" name="q" defaultValue={search} maxLength={ACCOUNT_SEARCH_MAX} placeholder={t("accounts.searchPlaceholder")} autoComplete="off" />}
        </Field>
        <Field id="accounts-filter" label={t("accounts.filterLabel")}>
          {(control) => (
            <NativeSelect {...control} name="filter" defaultValue={filter}>
              {ACCOUNT_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {t(`accounts.filters.${value}`)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="lg">
            {t("accounts.search")}
          </Button>
          {search !== "" || filter !== "all" ? (
            <Button asChild type="button" variant="ghost" size="lg">
              <Link href="/admin/accounts">{t("accounts.clear")}</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {accounts.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center text-text-2">{t(filter === "suspended" && search === "" ? "accounts.emptySuspended" : "accounts.empty")}</p>
      ) : (
        <ul className="grid gap-3">
          {accounts.map((account) => (
            <li key={account.id}>
              <article aria-label={`@${account.username}`} className="grid gap-3 rounded-3xl border border-white/8 bg-card p-5">
                <header className="flex flex-wrap items-center gap-3">
                  <UserAvatar username={account.username} displayName={account.display_name} avatarPath={account.avatar_path} size="md" alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{account.display_name}</p>
                    <p className="text-sm text-text-3">
                      @{account.username} · {t("accounts.joined", { date: day.format(new Date(account.created_at)) })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {account.role === "admin" ? <Badge variant="violet">{t("accounts.admin")}</Badge> : null}
                    {account.suspended ? <Badge variant="coral">{t("accounts.suspended")}</Badge> : null}
                  </div>
                </header>
                {account.suspended ? (
                  <p className="text-sm text-text-2">
                    {account.suspended_until ? t("accounts.suspendedUntil", { date: date.format(new Date(account.suspended_until)) }) : t("accounts.suspendedForever")}
                    {account.suspension_reason ? (
                      <span className="mt-1 block whitespace-pre-line">
                        {t("accounts.reason")}: {account.suspension_reason}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="ghost">
                    <Link href={`/u/${account.username}`}>{t("accounts.viewProfile")}</Link>
                  </Button>
                  {account.role === "admin" || account.id === me?.id ? (
                    <span className="text-sm text-text-3">{t("accounts.protected")}</span>
                  ) : (
                    <AccountActions userId={account.id} username={account.username} suspended={account.suspended} />
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      {truncated ? <p className="text-sm text-text-3">{t("accounts.truncated")}</p> : null}
    </section>
  );
}
