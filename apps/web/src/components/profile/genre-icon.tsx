import { FALLBACK_GENRE_ICON, GENRE_ICONS } from "./genre-icons";

/** Ícono decorativo del género (el nombre siempre va escrito al lado). */
export function GenreIcon({ id, className }: { id: string; className?: string }) {
  const Icon = GENRE_ICONS[id] ?? FALLBACK_GENRE_ICON;
  return <Icon aria-hidden="true" className={className} />;
}
