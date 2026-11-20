/**
 * Nombre fijo de la cookie de sesión. Por defecto @supabase/ssr lo deriva del hostname de la URL, y acá el
 * servidor (dentro de Docker) y el navegador usan hostnames distintos: sin un nombre fijo, no se verían la sesión.
 */
export const AUTH_COOKIE_NAME = "sb-tradfal-auth";

/** The session cookie: sent only over HTTPS when the site is served that way (local http keeps working). */
export const AUTH_COOKIE_OPTIONS = { name: AUTH_COOKIE_NAME, secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") } as const;
