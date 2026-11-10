import "server-only";
import { publicEnv } from "./env";

/**
 * Variables solo del servidor. Dentro de Docker el servidor llega a Supabase por la red interna
 * (SUPABASE_INTERNAL_URL) mientras el navegador usa la URL pública (NEXT_PUBLIC_SUPABASE_URL).
 */
export const serverEnv = {
  supabaseUrl: process.env.SUPABASE_INTERNAL_URL || publicEnv.supabaseUrl,
} as const;

/**
 * Almacenamiento de objetos compatible con S3 (en producción, Cloudflare R2; en local, el S3 de Supabase Storage).
 * Las credenciales viven SOLO en el servidor: nunca llevan el prefijo NEXT_PUBLIC_ ni llegan al navegador.
 */
export function assertStorageEnv(): {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  quarantineBucket: string;
  gamesBucket: string;
} {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Falta la configuración del almacenamiento de imágenes (S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY). " +
        "En local la genera ./start.sh; en producción son las credenciales de Cloudflare R2 (ver .env.example).",
    );
  }
  return {
    endpoint,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || endpoint,
    region: process.env.S3_REGION || "auto",
    accessKeyId,
    secretAccessKey,
    bucket: process.env.S3_BUCKET_MEDIA || "media",
    quarantineBucket: process.env.S3_BUCKET_QUARANTINE || "quarantine",
    gamesBucket: process.env.S3_BUCKET_GAMES || "games",
  };
}

/** Falla con un mensaje claro si falta la configuración de Supabase (en vez de un error críptico más adelante). */
export function assertSupabaseEnv(): { url: string; key: string } {
  if (!serverEnv.supabaseUrl || !publicEnv.supabaseKey) {
    throw new Error(
      "Falta la configuración de Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). " +
        "Levantá el proyecto con ./start.sh, que las genera solo.",
    );
  }
  return { url: serverEnv.supabaseUrl, key: publicEnv.supabaseKey };
}
