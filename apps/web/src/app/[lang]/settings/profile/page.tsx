import { Suspense } from "react";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocale, getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { countryOptions } from "@/lib/profile/catalog";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("profile.title"), robots: { index: false } };
}

export default async function SettingsProfilePage() {
  const t = await getTranslations("settings");
  return (
    <div className="grid gap-6">
      <header>
        <h2 className="font-display text-2xl leading-tight font-bold">{t("profile.title")}</h2>
        <p className="mt-1 text-text-2">{t("profile.subtitle")}</p>
      </header>
      <Suspense fallback={<ProfileSettingsSkeleton />}>
        <ProfileSettingsContent />
      </Suspense>
    </div>
  );
}

async function ProfileSettingsContent() {
  const { profile } = await requireProfile("/settings/profile");
  const locale = await getLocale();
  return (
    <>
      <AvatarEditor username={profile.username} displayName={profile.display_name} avatarPath={profile.avatar_path} />
      <EditProfileForm
        // Los nombres de países salen de Intl: se calculan acá (servidor) y viajan como datos. Si se calcularan
        // dentro del componente de cliente, Node y el navegador (datos ICU distintos) renderizarían texto diferente
        // y React fallaría al hidratar, regenerando el formulario y perdiendo lo que la persona ya escribió.
        countries={countryOptions(locale)}
        displayName={profile.display_name}
        bio={profile.bio}
        city={profile.city ?? ""}
        country={profile.country ?? ""}
        favoriteGenres={profile.favorite_genres}
      />
    </>
  );
}

function ProfileSettingsSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden="true">
      <Skeleton className="h-[220px] rounded-[28px]" />
      <Skeleton className="h-[520px] rounded-[28px]" />
      <Skeleton className="h-[140px] rounded-[28px]" />
      <Skeleton className="h-[360px] rounded-[28px]" />
    </div>
  );
}
