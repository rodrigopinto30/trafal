import { Suspense } from "react";
import { DeleteAccount } from "@/components/settings/delete-account";
import { SettingsSection } from "@/components/settings/settings-section";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";
import { getIsAdmin, requireProfile } from "@/lib/auth/dal";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("account.title"), robots: { index: false } };
}

export default async function SettingsAccountPage() {
  const t = await getTranslations("settings");
  return (
    <div className="grid gap-6">
      <header>
        <h2 className="font-display text-2xl leading-tight font-bold">{t("account.title")}</h2>
        <p className="mt-1 text-text-2">{t("account.subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[320px] rounded-[28px]" />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

/** Pide sesión y perfil: va dentro de <Suspense>. */
async function AccountContent() {
  const t = await getTranslations("settings");
  const { profile } = await requireProfile("/settings/account", { allowOutdatedTerms: true });
  const isAdmin = await getIsAdmin();
  return (
    <SettingsSection title={t("account.deleteTitle")} description={t("account.deleteText")}>
      <div className="grid gap-5">
        <div>
          <p className="text-sm font-semibold text-text-2">{t("account.removesTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-2">
            {(["profile", "games", "updates", "comments", "files"] as const).map((item) => (
              <li key={item}>{t(`account.removes.${item}`)}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-text-2">{t("account.keepsText")}</p>
        {isAdmin ? <p className="text-sm font-medium text-text-2">{t("account.adminNote")}</p> : <div><DeleteAccount username={profile.username} /></div>}
      </div>
    </SettingsSection>
  );
}
