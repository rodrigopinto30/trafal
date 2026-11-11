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

/** Whether the first account follows the second one, read like any visitor would (the lists of follows are public). */
export async function followsPerson(followerUsername: string, followeeUsername: string): Promise<boolean> {
  const [follower, followee] = await Promise.all([publicProfile(followerUsername, "id"), publicProfile(followeeUsername, "id")]);
  const response = await fetch(`${API}/rest/v1/follows?follower_id=eq.${follower.id}&followee_id=eq.${followee.id}&select=follower_id`, { headers: { apikey: publishableKey() } });
  return ((await response.json()) as unknown[]).length > 0;
}

/** The id of the latest published update of an account, read like any visitor would. */
export async function latestPostIdOf(username: string): Promise<string> {
  const authorId = String((await publicProfile(username, "id")).id);
  const response = await fetch(`${API}/rest/v1/posts?author_id=eq.${authorId}&select=id&order=created_at.desc&limit=1`, { headers: { apikey: publishableKey() } });
  const rows = (await response.json()) as { id: string }[];
  if (!rows[0]) throw new Error(`@${username} no tiene avances`);
  return rows[0].id;
}

/** The id of a published game, read like any visitor would. */
export async function gameIdOf(publicId: string): Promise<string> {
  const row = await publicGame(publicId, "id");
  if (!row) throw new Error(`No existe el juego ${publicId}`);
  return String(row.id);
}

/** Puts back a comment that a test left hidden (found by its exact text), moderating as the given admin. Does nothing if it is published. */
export async function restoreCommentByBody(body: string, adminToken: string): Promise<void> {
  const response = await fetch(`${API}/rest/v1/comments?body=eq.${encodeURIComponent(body)}&status=eq.hidden&select=id`, {
    headers: { apikey: publishableKey(), authorization: `Bearer ${adminToken}` },
  });
  const rows = (await response.json()) as { id: string }[];
  for (const row of rows) await callRpc("moderate_content", { p_target_type: "comment", p_target_id: row.id, p_action: "restore", p_reason: "Limpieza de la prueba" }, adminToken);
}

/** Dismisses the notifications that the given person received since a moment (what a test caused), acting as that person. */
export async function deleteNotificationsSince(token: string, sinceIso: string): Promise<void> {
  await fetch(`${API}/rest/v1/notifications?created_at=gte.${encodeURIComponent(sinceIso)}`, {
    method: "DELETE",
    headers: { apikey: publishableKey(), authorization: `Bearer ${token}` },
  });
}

/** The id of the person a token belongs to (the `sub` of the access token). */
export function userIdOf(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { sub: string };
  return payload.sub;
}

/** Inserts a row through the REST API as the person of the token, the way the browser could: the database decides. */
export async function insertRow(table: string, row: Record<string, unknown>, token: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const response = await fetch(`${API}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: publishableKey(), "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(row),
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, unknown> | null };
}

/** Deletes the rows of a table that match a PostgREST filter, as the person of the token (only their own, if the policies say so). */
export async function deleteRows(table: string, filter: string, token: string): Promise<void> {
  await fetch(`${API}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: { apikey: publishableKey(), authorization: `Bearer ${token}` } });
}
