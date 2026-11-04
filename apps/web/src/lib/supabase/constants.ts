/**
 * Nombre fijo de la cookie de sesión. Por defecto @supabase/ssr lo deriva del hostname de la URL, y acá el
 * servidor (dentro de Docker) y el navegador usan hostnames distintos: sin un nombre fijo, no se verían la sesión.
 */
export const AUTH_COOKIE_NAME = "sb-trafal-auth";
