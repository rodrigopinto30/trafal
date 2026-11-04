import { Suspense } from "react";
import { LanguageForm } from "@/components/settings/language-form";
import { SettingsSection } from "@/components/settings/settings-section";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("preferences.title"), robots: { index: false } };
}

export default async function SettingsPreferencesPage() {
  const t = await getTranslations("settings");
  return (
    <div className="grid gap-6">
      <header>
        <h2 className="font-display text-2xl leading-tight font-bold">{t("preferences.title")}</h2>
        <p className="mt-1 text-text-2">{t("preferences.subtitle")}</p>
      </header>
      <SettingsSection title={t("preferences.languageTitle")} description={t("preferences.languageText")}>
        <Suspense fallback={<Skeleton className="h-[170px]" />}>
          <PreferencesContent />
        </Suspense>
      </SettingsSection>
    </div>
  );
}

/** Pide sesión y perfil: va dentro de <Suspense>. */
async function PreferencesContent() {
  await requireProfile("/settings/preferences");
  return <LanguageForm />;
}
