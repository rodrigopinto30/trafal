import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { assertSupabaseEnv } from "@/lib/env.server";
import { AUTH_COOKIE_NAME } from "./constants";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers. Corre con la sesión de la
 * persona (cookies), así que RLS decide qué puede ver y hacer. Crear uno nuevo por request: nunca compartirlo.
 */
export async function createClient() {
  // La sesión solo existe cuando llega una persona real. Sin esto, el prefetch parcial de Next («App Shell por sesión»)
  // intenta pre-renderizar este código con las cookies de quien navega: el cliente de Supabase Auth lee la hora para
  // saber si el token venció y Next lo reporta como valor inestable en cada prefetch (error en el log, trabajo inútil).
  await connection();
  const { url, key } = assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
}
