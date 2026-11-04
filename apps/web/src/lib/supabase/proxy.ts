import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { assertSupabaseEnv } from "@/lib/env.server";
import { AUTH_COOKIE_NAME } from "./constants";

/**
 * Refresca la sesión de Supabase en cada navegación (los Server Components no pueden escribir cookies, así
 * que alguien tiene que hacerlo: el proxy). `createResponse` se vuelve a llamar si hay cookies nuevas, para
 * que el render que viene después reciba el token ya renovado.
 */
export async function updateSession(request: NextRequest, createResponse: () => NextResponse): Promise<NextResponse> {
  let response = createResponse();

  // Visitantes sin sesión: no hace falta ir hasta Supabase.
  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.startsWith(AUTH_COOKIE_NAME));
  if (!hasSession) return response;

  const { url, key } = assertSupabaseEnv();
  const supabase = createServerClient(url, key, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = createResponse();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Las respuestas que escriben cookies de sesión nunca deben cachearse en un CDN.
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  // getClaims() valida el token (y lo renueva si está por vencer). No se usa nada de lo que devuelve.
  await supabase.auth.getClaims();
  return response;
}
