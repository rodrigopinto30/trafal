"use client";

import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { signOutAction } from "@/lib/auth/actions";
import { UserAvatar } from "@/components/brand/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Menú de la cuenta (avatar → mi perfil, configuración, cerrar sesión). */
export function UserMenu({ username, displayName, avatarPath, isAdmin }: { username: string; displayName: string; avatarPath: string | null; isAdmin: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("account")}
          className="grid size-11 shrink-0 place-items-center rounded-2xl outline-none transition-shadow hover:shadow-glow-violet focus-visible:ring-2 focus-visible:ring-cyan"
        >
          <UserAvatar username={username} displayName={displayName} avatarPath={avatarPath} size="md" alt="" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 text-sm">
          <span className="truncate font-semibold text-foreground">{displayName}</span>
          <span className="truncate text-text-3">@{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/u/${username}`}>{t("myProfile")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/saved">{t("saved")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">{t("settings")}</Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">{t("admin")}</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <input type="hidden" name="lang" value={locale} />
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-left">
              {t("logout")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
