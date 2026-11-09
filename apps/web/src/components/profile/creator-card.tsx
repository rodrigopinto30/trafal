import { MapPinIcon } from "lucide-react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { FollowButton } from "@/components/profile/follow-button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import type { CreatorCard as Creator } from "@/lib/games/queries";

type Props = { creator: Creator; signedIn: boolean; isOwn: boolean; following: boolean };

const SHOWN_ENGINES = 3;

/** A person in the creators directory: who they are, what they use, what they have published, and a button to follow them. */
export async function CreatorCard({ creator, signedIn, isOwn, following }: Props) {
  const [t, tEngines, locale] = await Promise.all([getTranslations("creators"), getTranslations("engines"), getLocale()]);
  const country = creator.country ? new Intl.DisplayNames([locale], { type: "region" }).of(creator.country) : null;
  const place = [creator.city, country].filter(Boolean).join(", ");
  const engines = creator.engines.slice(0, SHOWN_ENGINES);

  return (
    <article className="flex h-full flex-col gap-4 rounded-3xl border border-white/8 bg-card p-5 transition-shadow duration-200 focus-within:shadow-card-hover hover:shadow-card-hover">
      <div className="flex items-start gap-4">
        <UserAvatar username={creator.username} displayName={creator.display_name} avatarPath={creator.avatar_path} size="lg" alt="" />
        <div className="min-w-0 leading-snug">
          <h3 className="truncate font-display text-lg font-bold">
            <Link href={`/u/${creator.username}`} aria-label={t("viewProfile", { name: creator.display_name })} className="rounded-lg hover:text-cyan hover:underline">
              {creator.display_name}
            </Link>
          </h3>
          <p className="truncate text-sm text-text-3">@{creator.username}</p>
          {place ? (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-text-3">
              <MapPinIcon aria-hidden="true" className="size-3.5 shrink-0" />
              {place}
            </p>
          ) : null}
        </div>
      </div>

      {creator.bio ? <p className="line-clamp-3 text-sm text-text-2">{creator.bio}</p> : null}

      {engines.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {engines.map((engine) => (
            <li key={engine}>
              <Badge variant="soft">{tEngines(engine as Parameters<typeof tEngines>[0])}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-2">
          {t("games", { count: creator.games_count })} · {t("followers", { count: creator.followers_count })}
        </p>
        {isOwn ? null : <FollowButton targetId={creator.id} username={creator.username} initialFollowing={following} signedIn={signedIn} />}
      </div>
    </article>
  );
}
