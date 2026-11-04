import { publicEnv } from "@/lib/env";

/**
 * URL pública de un archivo del bucket de medios a partir de la ruta que guarda la base (`profiles.avatar_path`).
 * Devuelve null si no hay ruta o si el sitio no tiene configurada la URL de medios (la interfaz cae a la letra).
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path || !publicEnv.mediaUrl) return null;
  return `${publicEnv.mediaUrl.replace(/\/+$/, "")}/${path}`;
}
