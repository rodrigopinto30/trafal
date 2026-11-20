import { Suspense } from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { ChangePassword } from "@/components/settings/change-password";
import { DeleteAccount } from "@/components/settings/delete-account";
import { SettingsSection } from "@/components/settings/settings-section";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";
import { RECENT_SIGN_IN_SECONDS, getIsAdmin, requireProfile, signedInRecently } from "@/lib/auth/dal";
import { oauthProvidersOf, reauthMethodOf } from "@/lib/auth/reauth";

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
      <Suspense fallback={<Skeleton className="h-[760px] rounded-[28px]" />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

/** Pide sesión y perfil: va dentro de <Suspense>. */
async function AccountContent() {
  const t = await getTranslations("settings");
  const { user, profile } = await requireProfile("/settings/account", { allowOutdatedTerms: true });
  const isAdmin = await getIsAdmin();
  const method = reauthMethodOf(user);
  const providers = oauthProvidersOf(user);
  const mustSignInAgain = method === "email" && !(await signedInRecently(RECENT_SIGN_IN_SECONDS));
  const providerNames = providers.map((name) => name[0]?.toUpperCase() + name.slice(1)).join(" / ");
  return (
    <>
      {method === "password" ? (
        <SettingsSection title={t("password.title")} description={t("password.description")}>
          <ChangePassword />
        </SettingsSection>
      ) : (
        <SettingsSection title={t("password.title")}>
          <p className="text-sm text-text-2">{t("password.noPasswordText", { providers: providerNames })}</p>
        </SettingsSection>
      )}
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
          {isAdmin ? (
            <p className="text-sm font-medium text-text-2">{t("account.adminNote")}</p>
          ) : mustSignInAgain ? (
            <div className="grid max-w-[420px] gap-3 rounded-2xl border border-white/10 p-5">
              <p className="font-semibold">{t("account.reauthTitle")}</p>
              <p className="text-sm text-text-2">{t("account.reauthText", { providers: providerNames })}</p>
              <OAuthButtons next="/settings/account" only={providers} />
            </div>
          ) : (
            <div>
              <DeleteAccount username={profile.username} method={method} />
            </div>
          )}
        </div>
      </SettingsSection>
    </>
  );
}
