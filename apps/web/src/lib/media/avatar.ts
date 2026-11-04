/**
 * Reglas de la foto de perfil. Las comparten el navegador (que recorta y reduce la imagen) y el servidor (que NO se
 * fía y vuelve a comprobar todo antes de guardarla). La ruta que se guarda en `profiles.avatar_path` la valida
 * además un CHECK de la base de datos (profiles_avatar_path_fmt).
 */

/** Lado de la imagen final, en píxeles. Se muestra hasta a 112 px CSS, o sea 224 px en pantallas con doble densidad. */
export const AVATAR_SIZE = 256;

/** Una foto de 256×256 pesa ~20–60 KB; 200 KB es holgado y deja afuera cualquier cosa rara. */
export const MAX_AVATAR_BYTES = 200 * 1024;

/** Formatos aceptados. WebP es el normal; JPEG es el reemplazo para navegadores que no saben codificar WebP (Safari). */
export const AVATAR_FORMATS = {
  webp: { mime: "image/webp", ext: "webp" },
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
} as const;

export type AvatarFormat = keyof typeof AVATAR_FORMATS;

/** Archivo de entrada que se le deja elegir a la persona (antes de recortar). Más que esto no se intenta decodificar. */
export const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024;

/** `avatars/<id de la persona>/<32 hex>.<webp|jpg|png>` — mismo patrón que el CHECK de la base de datos. */
export function avatarPathPattern(userId: string): RegExp {
  return new RegExp(`^avatars/${userId}/[0-9a-f]{32}\\.(webp|jpg|png)$`);
}

export function avatarObjectKey(userId: string, token: string, format: AvatarFormat): string {
  return `avatars/${userId}/${token}.${AVATAR_FORMATS[format].ext}`;
}
