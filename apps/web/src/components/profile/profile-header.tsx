import { MapPinIcon } from "lucide-react";
import type { ReactNode } from "react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { GenreIcon } from "@/components/profile/genre-icon";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { GENRE_IDS } from "@/lib/profile/catalog";
import type { Database } from "@/lib/supabase/database.types";

export type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id"
  | "username"
  | "display_name"
  | "avatar_path"
  | "bio"
  | "city"
  | "country"
  | "engines"
  | "favorite_genres"
  | "followers_count"
  | "following_count"
  | "created_at"
>;

type Props = {
  profile: ProfileRow;
  gamesCount: number;
  postsCount: number;
  /** Botón de acción (Seguir / Editar perfil). */
  action: ReactNode;
};

export async function ProfileHeader({ profile, gamesCount, postsCount, action }: Props) {
  const t = await getTranslations("profile");
  const tEngines = await getTranslations("engines");
  const tGenres = await getTranslations("genres");
  const locale = await getLocale();
  const countryName = profile.country ? new Intl.DisplayNames([locale], { type: "region" }).of(profile.country) : null;
  const location = [profile.city, countryName].filter(Boolean).join(", ");
  const number = new Intl.NumberFormat(locale);
  // En el orden de la grilla (no en el orden alfabético en que los guarda la base).
  const favoriteGenres = GENRE_IDS.filter((id) => profile.favorite_genres.includes(id));

  return (
    <section className="rounded-[28px] border border-white/8 bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start gap-5 sm:gap-7">
        <UserAvatar username={profile.username} displayName={profile.display_name} avatarPath={profile.avatar_path} size="xl" alt="" />

        <div className="min-w-0 flex-1 basis-60">
          <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-tight font-bold break-words text-glow-violet">{profile.display_name}</h1>
          <p className="mt-0.5 text-text-3">@{profile.username}</p>

          {profile.bio ? <p className="mt-3 max-w-[60ch] break-words whitespace-pre-line text-text-2">{profile.bio}</p> : null}

          {location ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-text-2">
              <MapPinIcon aria-hidden="true" className="size-4 text-cyan" />
              {location}
            </p>
          ) : null}

          {profile.engines.length > 0 ? (
            <div className="mt-4">
              <p className="sr-only">{t("enginesLabel")}</p>
              <ul className="flex flex-wrap gap-2">
                {profile.engines.map((engine) => (
                  <li key={engine}>
                    <Badge variant="soft" className="px-3 py-1.5 text-xs">
                      {tEngines(engine as Parameters<typeof tEngines>[0])}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {favoriteGenres.length > 0 ? (
            <div className="mt-3">
              <p className="sr-only">{t("genresLabel")}</p>
              <ul className="flex flex-wrap gap-2">
                {favoriteGenres.map((id) => (
                  <li key={id}>
                    <Badge variant="cyan" className="gap-1.5 px-3 py-1.5 text-xs">
                      <GenreIcon id={id} className="size-3.5" />
                      {tGenres(id as Parameters<typeof tGenres>[0])}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 max-sm:w-full [&>*]:max-sm:w-full">{action}</div>
      </div>

      <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/8 pt-4 text-sm text-text-2">
        <li>
          <Link href={`/u/${profile.username}/followers`} className="inline-flex min-h-11 items-center gap-1.5 hover:text-white">
            <strong className="text-base text-foreground">{number.format(profile.followers_count)}</strong>
            {t("followersLabel", { count: profile.followers_count })}
          </Link>
        </li>
        <li>
          <Link href={`/u/${profile.username}/following`} className="inline-flex min-h-11 items-center gap-1.5 hover:text-white">
            <strong className="text-base text-foreground">{number.format(profile.following_count)}</strong>
            {t("followingLabel", { count: profile.following_count })}
          </Link>
        </li>
        <li className="inline-flex min-h-11 items-center gap-1.5 text-text-3">
          <strong className="text-base text-foreground">{number.format(gamesCount)}</strong>
          {t("gamesLabel", { count: gamesCount })}
        </li>
        <li className="inline-flex min-h-11 items-center gap-1.5 text-text-3">
          <strong className="text-base text-foreground">{number.format(postsCount)}</strong>
          {t("postsLabel", { count: postsCount })}
        </li>
      </ul>
    </section>
  );
}
