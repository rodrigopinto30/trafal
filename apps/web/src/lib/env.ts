/**
 * Variables PÚBLICAS (llegan al navegador). Next solo reemplaza `process.env.NEXT_PUBLIC_X` cuando se lee
 * de forma literal, por eso cada una se escribe a mano acá.
 */
export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  googleEnabled: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
  /** Clave pública del captcha de Cloudflare Turnstile. Vacía: no se muestra el captcha (solo es válido fuera de un sitio público). */
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  /** URL pública desde donde se leen las imágenes subidas (en producción, el dominio público del bucket de R2). */
  mediaUrl: process.env.NEXT_PUBLIC_MEDIA_URL ?? "",
  /** Origin of the games domain without the game id (http://games.localhost:4000): each game lives at <public_id>.<that host>. */
  gamesBaseUrl: process.env.NEXT_PUBLIC_GAMES_BASE_URL ?? "",
} as const;
