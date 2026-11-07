import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { getAuthUser, getMyProfile } from "@/lib/auth/dal";
import { signOutAction } from "@/lib/auth/actions";
import { UserAvatar } from "@/components/brand/user-avatar";
import { UserMenu } from "./user-menu";

/** Zona de la cuenta en la barra (escritorio). Lee la sesión: va SIEMPRE dentro de un <Suspense>. */
export async function NavUser() {
  const t = await getTranslations("nav");
  const [user, profile] = await Promise.all([getAuthUser(), getMyProfile()]);

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" asChild className="hidden md:inline-flex">
          <Link href="/login">{t("login")}</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">{t("signup")}</Link>
        </Button>
      </div>
    );
  }

  // Con sesión pero sin perfil: le falta terminar el onboarding.
  if (!profile) {
    return (
      <Button asChild>
        <Link href="/onboarding">{t("completeProfile")}</Link>
      </Button>
    );
  }

  return <UserMenu username={profile.username} displayName={profile.display_name} avatarPath={profile.avatar_path} />;
}

/** Zona de la cuenta dentro del menú móvil. */
export async function MobileAccount() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const [user, profile] = await Promise.all([getAuthUser(), getMyProfile()]);

  const itemClass =
    "flex h-[50px] w-full items-center gap-3 rounded-xl px-[18px] text-left text-lg font-semibold text-text-2 transition-colors hover:bg-white/5 hover:text-white";

  if (!user) {
    return (
      <div className="flex flex-col gap-1">
        <Link href="/login" className={itemClass}>
          {t("login")}
        </Link>
        <Link href="/signup" className={`${itemClass} text-cyan`}>
          {t("signup")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {profile ? (
        <>
          <div className="flex items-center gap-3 px-[18px] py-2">
            <UserAvatar username={profile.username} displayName={profile.display_name} avatarPath={profile.avatar_path} size="md" alt="" />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-semibold">{profile.display_name}</div>
              <div className="truncate text-sm text-text-3">@{profile.username}</div>
            </div>
          </div>
          <Link href={`/u/${profile.username}`} className={itemClass}>
            {t("myProfile")}
          </Link>
          <Link href="/saved" className={itemClass}>
            {t("saved")}
          </Link>
          <Link href="/settings/profile" className={itemClass}>
            {t("settings")}
          </Link>
        </>
      ) : (
        <Link href="/onboarding" className={itemClass}>
          {t("completeProfile")}
        </Link>
      )}
      <form action={signOutAction}>
        <input type="hidden" name="lang" value={locale} />
        <button type="submit" className={itemClass}>
          {t("logout")}
        </button>
      </form>
    </div>
  );
}
