import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { assertSupabaseEnv } from "@/lib/env.server";
import { AUTH_COOKIE_NAME } from "./constants";

type PendingCookie = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Refresca la sesión de Supabase en cada navegación (los Server Components no pueden escribir cookies, así
 * que alguien tiene que hacerlo: el proxy). `createResponse` recibe si hay una sesión válida (para que el proxy pueda servir otra
 * página a quien inició sesión) y se llama una sola vez, ya con el token renovado en la petición.
 */
export async function updateSession(request: NextRequest, createResponse: (signedIn: boolean) => NextResponse): Promise<NextResponse> {
  // Visitantes sin sesión: no hace falta ir hasta Supabase.
  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.startsWith(AUTH_COOKIE_NAME));
  if (!hasSession) return createResponse(false);

  const { url, key } = assertSupabaseEnv();
  let refreshed: { cookies: PendingCookie[]; headers: Record<string, string> } | null = null;
  const supabase = createServerClient(url, key, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        refreshed = { cookies: cookiesToSet, headers };
      },
    },
  });

  // getClaims() valida el token (y lo renueva si está por vencer).
  const { data } = await supabase.auth.getClaims();
  const response = createResponse(Boolean(data?.claims));
  const pending = refreshed as { cookies: PendingCookie[]; headers: Record<string, string> } | null;
  if (pending) {
    for (const { name, value, options } of pending.cookies) response.cookies.set(name, value, options);
    // Las respuestas que escriben cookies de sesión nunca deben cachearse en un CDN.
    for (const [header, value] of Object.entries(pending.headers)) response.headers.set(header, value);
  }
  return response;
}
