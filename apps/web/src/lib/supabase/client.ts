import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { AUTH_COOKIE_NAME } from "./constants";
import type { Database } from "./database.types";

/** Cliente de Supabase para Componentes de Cliente (consultas públicas, tiempo real). */
export function createClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
  });
}
