import { UserAvatar } from "@/components/brand/user-avatar";
import { FollowButton } from "@/components/profile/follow-button";
import { Link } from "@/i18n/link";

export type PersonRow = { id: string; username: string; display_name: string; avatar_path: string | null; bio: string };

type Viewer = { signedIn: boolean; userId: string | null; following: ReadonlySet<string> };

/**
 * Lista de perfiles (seguidores / seguidos), cada uno con su botón de seguir o dejar de seguir (menos la propia cuenta), así no hace
 * falta entrar a cada perfil. El botón no recarga la página: la persona queda en su lugar y se puede volver a seguir.
 */
export function ProfileList({ people, emptyText, viewer }: { people: PersonRow[]; emptyText: string; viewer: Viewer }) {
  if (people.length === 0) {
    return <p className="rounded-3xl border border-dashed border-white/20 px-6 py-10 text-center text-text-2">{emptyText}</p>;
  }
  return (
    <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
      {people.map((person) => (
        <li key={person.username}>
          <article className="flex h-full flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border border-white/8 bg-card p-4 transition-shadow duration-200 focus-within:shadow-card-hover hover:shadow-card-hover">
            <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 basis-[200px] items-center gap-4 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan">
              <UserAvatar username={person.username} displayName={person.display_name} avatarPath={person.avatar_path} size="lg" alt="" />
              <span className="min-w-0 leading-snug">
                <span className="block truncate font-bold text-foreground">{person.display_name}</span>
                <span className="block truncate text-sm text-text-3">@{person.username}</span>
                {person.bio ? <span className="mt-1 line-clamp-2 block text-sm text-text-2">{person.bio}</span> : null}
              </span>
            </Link>
            {viewer.userId === person.id ? null : (
              <FollowButton targetId={person.id} username={person.username} initialFollowing={viewer.following.has(person.id)} signedIn={viewer.signedIn} refreshAfter={false} />
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
