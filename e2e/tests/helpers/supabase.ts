import { readFileSync } from "node:fs";
import path from "node:path";

/** Clave pública (publishable) de Supabase local: la deja ./start.sh en .env.supabase. Alcanza para leer datos públicos. */
function publishableKey(): string {
  const fromEnv = process.env.E2E_SUPABASE_KEY;
  if (fromEnv) return fromEnv;
  // Playwright corre con la carpeta e2e/ como directorio actual (e2e/run.sh): el archivo está un nivel más arriba.
  const file = readFileSync(path.resolve(process.cwd(), "../.env.supabase"), "utf8");
  return /^SUPABASE_PUBLISHABLE_KEY=(.+)$/m.exec(file)?.[1] ?? "";
}

const API = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";

/** Lee columnas públicas de un perfil directo de la API REST (lo mismo que vería cualquier visitante). */
export async function publicProfile(username: string, columns = "avatar_path,favorite_genres,engines"): Promise<Record<string, unknown>> {
  const response = await fetch(`${API}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=${columns}`, {
    headers: { apikey: publishableKey() },
  });
  const rows = (await response.json()) as Record<string, unknown>[];
  if (!rows[0]) throw new Error(`No existe el perfil @${username}`);
  return rows[0];
}

/**
 * Crea una cuenta directo en Supabase Auth, SIN pasar por el formulario de registro de Trafal: no queda constancia de que
 * haya tildado «18 años o más y términos». Es exactamente lo que pasa con quien entra con Google. Manda el mail de confirmación.
 */
export async function signUpWithoutConsent(email: string, password: string): Promise<void> {
  const response = await fetch(`${API}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: publishableKey(), "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`No se pudo crear la cuenta de prueba: ${response.status} ${await response.text()}`);
}

/** Reads public columns of a published game from the REST API (what any visitor could read). */
export async function publicGame(publicId: string, columns = "play_count,status"): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${API}/rest/v1/games?public_id=eq.${encodeURIComponent(publicId)}&select=${columns}`, {
    headers: { apikey: publishableKey() },
  });
  const rows = (await response.json()) as Record<string, unknown>[];
  return rows[0] ?? null;
}

/** Signs in a seeded account straight against Supabase Auth and returns its access token (so a test can call the API as that person). */
export async function accessTokenOf(email: string, password: string): Promise<string> {
  const response = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey(), "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`No se pudo entrar como ${email}: ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

/** Calls a database function through the REST API, as the given person (or as a visitor with no token). */
export async function callRpc(name: string, args: Record<string, unknown>, token?: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${API}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: publishableKey(), "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(args),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/** The id of a published game, read like any visitor would. */
export async function gameIdOf(publicId: string): Promise<string> {
  const row = await publicGame(publicId, "id");
  if (!row) throw new Error(`No existe el juego ${publicId}`);
  return String(row.id);
}
