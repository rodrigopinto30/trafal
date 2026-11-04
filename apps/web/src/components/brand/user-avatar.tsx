import { avatarGradient, avatarInitial } from "@/lib/avatar";
import { mediaUrl } from "@/lib/media/url";
import { cn } from "@/lib/utils";

/** Lado en píxeles de cada tamaño (mismo valor que las clases): se usa como width/height del <img> para no mover el diseño al cargar. */
const SIZES = {
  sm: { classes: "size-8 text-sm rounded-xl", px: 32 },
  md: { classes: "size-11 text-base rounded-2xl", px: 44 },
  lg: { classes: "size-16 text-2xl rounded-[22px]", px: 64 },
  xl: { classes: "size-24 text-4xl rounded-[30px] sm:size-28", px: 112 },
} as const;

type UserAvatarProps = {
  username: string;
  displayName: string;
  /** Ruta de la foto (`profiles.avatar_path`). Sin ella se muestra la letra de colores. */
  avatarPath?: string | null;
  size?: keyof typeof SIZES;
  /** Texto alternativo; por defecto, el nombre. Pasar "" si el nombre ya está al lado (decorativo). */
  alt?: string;
  className?: string;
};

/**
 * Avatar: la foto de la persona si la subió; si no (o si la imagen no carga), un degradé con su inicial.
 * La letra queda siempre debajo de la foto, así que si el archivo falla se ve la letra y no un ícono roto.
 * Es decorativo cuando el nombre se muestra al lado.
 */
export function UserAvatar({ username, displayName, avatarPath, size = "md", alt, className }: UserAvatarProps) {
  const [from, to] = avatarGradient(username);
  const label = alt ?? displayName;
  const src = mediaUrl(avatarPath);
  const { classes, px } = SIZES[size];

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden font-display font-bold text-ink select-none",
        classes,
        className,
      )}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span aria-hidden="true">{avatarInitial(displayName, username)}</span>
      {src ? (
        // <img> común y no next/image: ya es un WebP de 256 px con caché inmutable, no hay nada que optimizar, y el
        // optimizador de Next exigiría declarar el dominio del almacenamiento. La imagen es decorativa (alt vacío).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}
