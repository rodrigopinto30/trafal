/**
 * Variables PÚBLICAS (llegan al navegador). Next solo reemplaza `process.env.NEXT_PUBLIC_X` cuando se lee
 * de forma literal, por eso cada una se escribe a mano acá.
 */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  googleEnabled: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
  /** URL pública desde donde se leen las imágenes subidas (en producción, el dominio público del bucket de R2). */
  mediaUrl: process.env.NEXT_PUBLIC_MEDIA_URL ?? "",
} as const;
