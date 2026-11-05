import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GameShelf } from "@/components/games/game-shelf";
import { PostCard } from "@/components/games/post-card";
import { FollowButton } from "@/components/profile/follow-button";
import { ProfileHeader, type ProfileRow } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { PROFILE_COLUMNS, getAuthUser } from "@/lib/auth/dal";
import { listGamesByOwner, listOwnUnpublishedGames, listPostsByAuthor, type OwnGame } from "@/lib/games/queries";
import { createClient } from "@/lib/supabase/server";
import { parseUsernameParam } from "@/lib/validation/common";

export async function generateMetadata({ params }: PageProps<"/[lang]/u/[username]">) {
  const { username } = await params;
  return { title: `@${parseUsernameParam(username) ?? ""}` };
}

export default function ProfilePage({ params }: PageProps<"/[lang]/u/[username]">) {
  return (
    <div className="mx-auto max-w-[960px] px-5 pt-[clamp(24px,5vw,48px)]">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProfileContent({ params }: { params: PageProps<"/[lang]/u/[username]">["params"] }) {
  const { username: rawUsername } = await params;
  // Un @usuario con forma imposible (o con percent-encoding roto) no puede existir: 404 sin consultar la base.
  const username = parseUsernameParam(rawUsername);
  if (!username) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("username", username).maybeSingle();
  if (!data) notFound();
  const profile: ProfileRow = data;

  const [t, me, games, posts] = await Promise.all([
    getTranslations("profile"),
    getAuthUser(),
    listGamesByOwner(profile.id),
    listPostsByAuthor(profile.id),
  ]);
  const isOwn = me?.id === profile.id;
  const unpublished = isOwn ? await listOwnUnpublishedGames(profile.id) : [];
  const now = new Date();

  let isFollowing = false;
  if (me && !isOwn) {
    const { data: follow } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", me.id)
      .eq("followee_id", profile.id)
      .maybeSingle();
    isFollowing = Boolean(follow);
  }

  const action = isOwn ? (
    <Button asChild variant="outline" size="lg">
      <Link href="/settings/profile">{t("edit")}</Link>
    </Button>
  ) : (
    <FollowButton targetId={profile.id} username={profile.username} initialFollowing={isFollowing} signedIn={Boolean(me)} />
  );

  // Solo a la propia persona, y solo mientras le falte algo: la invitación a terminar el perfil.
  const incomplete = isOwn && (!profile.avatar_path || profile.favorite_genres.length === 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <ProfileHeader profile={profile} gamesCount={games.length} postsCount={posts.length} action={action} />
      {incomplete ? <CompleteProfileCard title={t("completeTitle")} text={t("completeText")} cta={t("completeCta")} /> : null}
      {unpublished.length > 0 ? <UnpublishedGames title={t("ownDraftsTitle")} cta={t("manageGame")} games={unpublished} /> : null}
      <ProfileTabs
        gamesPanel={
          games.length > 0 ? (
            <GameShelf games={games} columns={3} />
          ) : (
            <EmptyState text={isOwn ? t("empty.gamesOwn") : t("empty.gamesOther")} cta={isOwn ? { href: "/games/new", label: t("empty.cta") } : undefined} />
          )
        }
        postsPanel={
          posts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} now={now} />
              ))}
            </div>
          ) : (
            <EmptyState text={isOwn ? t("empty.postsOwn") : t("empty.postsOther")} />
          )
        }
      />
    </div>
  );
}

function CompleteProfileCard({ title, text, cta }: { title: string; text: string; cta: string }) {
  return (
    <aside className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-cyan/30 bg-cyan/6 p-5 sm:p-6">
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-text-2">{text}</p>
      </div>
      <Button asChild variant="outline" size="lg">
        <Link href="/settings/profile">{cta}</Link>
      </Button>
    </aside>
  );
}

function UnpublishedGames({ title, cta, games }: { title: string; cta: string; games: OwnGame[] }) {
  return (
    <section aria-label={title} className="grid gap-3 rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <ul className="grid gap-2">
        {games.map((game) => (
          <li key={game.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0 truncate font-semibold">{game.title}</span>
            <Button asChild variant="outline" size="default">
              <Link href={`/games/${game.public_id}/manage`}>{cta}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/20 px-6 py-12 text-center">
      <p className="text-text-2">{text}</p>
      {cta ? (
        <Button asChild size="lg" className="mt-5">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-8" aria-hidden="true">
      <Skeleton className="h-[300px] rounded-[28px] sm:h-[260px]" />
      <Skeleton className="h-12 w-72 rounded-full" />
      <Skeleton className="h-40" />
    </div>
  );
}
