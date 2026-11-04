import { UserAvatar } from "@/components/brand/user-avatar";
import { Link } from "@/i18n/link";

export type PersonRow = { username: string; display_name: string; avatar_path: string | null; bio: string };

/** Lista de perfiles (seguidores / seguidos). */
export function ProfileList({ people, emptyText }: { people: PersonRow[]; emptyText: string }) {
  if (people.length === 0) {
    return <p className="rounded-3xl border border-dashed border-white/20 px-6 py-10 text-center text-text-2">{emptyText}</p>;
  }
  return (
    <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]">
      {people.map((person) => (
        <li key={person.username}>
          <Link
            href={`/u/${person.username}`}
            className="flex items-center gap-4 rounded-3xl border border-white/8 bg-card p-4 transition-shadow duration-200 hover:shadow-card-hover focus-visible:shadow-card-hover"
          >
            <UserAvatar username={person.username} displayName={person.display_name} avatarPath={person.avatar_path} size="lg" alt="" />
            <span className="min-w-0 leading-snug">
              <span className="block truncate font-bold text-foreground">{person.display_name}</span>
              <span className="block truncate text-sm text-text-3">@{person.username}</span>
              {person.bio ? <span className="mt-1 line-clamp-2 block text-sm text-text-2">{person.bio}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
