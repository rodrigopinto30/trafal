import { expect, test } from "@playwright/test";
import { gotoReady } from "./helpers/session";
import { accessTokenOf, callRpc, gameIdOf } from "./helpers/supabase";

/**
 * The first game of the week, chosen by an admin through the audited database functions (there is no screen for it yet). The
 * test chooses and takes off picks as the example admin and always leaves the data as it found it.
 */
test.describe.configure({ mode: "serial" });

const QUOTE = "Frase de prueba del juego de la semana";
const FUTURE_QUOTE = "Frase de una semana que todavía no empezó";

function mondayOf(offsetWeeks: number): string {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7) + offsetWeeks * 7);
  return day.toISOString().slice(0, 10);
}

function tuesdayOf(offsetWeeks: number): string {
  const day = new Date(`${mondayOf(offsetWeeks)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

let adminToken = "";

test.beforeAll(async () => {
  adminToken = await accessTokenOf("admin@trafal.test", "trafal123");
});

test.afterAll(async () => {
  await callRpc("clear_featured_game", { p_week_start: mondayOf(0) }, adminToken);
  await callRpc("clear_featured_game", { p_week_start: mondayOf(1) }, adminToken);
});

test("el admin elige el juego de la semana y la portada lo muestra con su frase", async ({ page }) => {
  const game = await gameIdOf("kart-de-carton");
  const chosen = await callRpc("set_featured_game", { p_game_id: game, p_week_start: null, p_quote: QUOTE }, adminToken);
  expect(chosen).toEqual({ status: 200, body: mondayOf(0) });

  await gotoReady(page, "/");
  await expect(page.getByText(QUOTE)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kart de Cartón", level: 2 }).first()).toBeVisible();
});

test("elegir una semana que viene no cambia la portada de hoy", async ({ page }) => {
  const game = await gameIdOf("colectivo-152");
  expect((await callRpc("set_featured_game", { p_game_id: game, p_week_start: mondayOf(1), p_quote: FUTURE_QUOTE }, adminToken)).status).toBe(200);

  await gotoReady(page, "/");
  await expect(page.getByText(QUOTE)).toBeVisible();
  await expect(page.getByText(FUTURE_QUOTE)).toHaveCount(0);
});

test("la base rechaza lo que no corresponde y no toca nada", async () => {
  const kart = await gameIdOf("kart-de-carton");
  const neon = await gameIdOf("neon-express");

  const notFirst = await callRpc("set_featured_game", { p_game_id: neon, p_week_start: null, p_quote: null }, adminToken);
  expect(notFirst.status).toBe(400);
  expect(notFirst.body).toMatchObject({ message: "featured_requires_published_first_game" });

  const twice = await callRpc("set_featured_game", { p_game_id: kart, p_week_start: mondayOf(2), p_quote: null }, adminToken);
  expect(twice.body).toMatchObject({ message: "game_already_featured" });

  const notMonday = await callRpc("set_featured_game", { p_game_id: kart, p_week_start: tuesdayOf(0), p_quote: null }, adminToken);
  expect(notMonday.body).toMatchObject({ message: "week_not_monday" });

  const past = await callRpc("set_featured_game", { p_game_id: kart, p_week_start: mondayOf(-1), p_quote: null }, adminToken);
  expect(past.body).toMatchObject({ message: "week_in_the_past" });
});

test("nadie más que un admin puede elegir ni sacar", async () => {
  const game = await gameIdOf("kart-de-carton");
  const creator = await accessTokenOf("valen@trafal.test", "trafal123");

  const byCreator = await callRpc("set_featured_game", { p_game_id: game, p_week_start: null, p_quote: "yo elijo" }, creator);
  expect(byCreator.status).toBe(403);
  expect(byCreator.body).toMatchObject({ message: "not_admin" });
  expect((await callRpc("clear_featured_game", { p_week_start: null }, creator)).status).toBe(403);

  const byVisitor = await callRpc("set_featured_game", { p_game_id: game, p_week_start: null, p_quote: "visita" });
  expect([401, 403]).toContain(byVisitor.status);
});

test("al sacar las elecciones vuelve la anterior", async ({ page }) => {
  expect((await callRpc("clear_featured_game", { p_week_start: mondayOf(1) }, adminToken)).body).toBe(true);
  expect((await callRpc("clear_featured_game", { p_week_start: mondayOf(0) }, adminToken)).body).toBe(true);
  expect((await callRpc("clear_featured_game", { p_week_start: mondayOf(0) }, adminToken)).body).toBe(false);

  await gotoReady(page, "/");
  await expect(page.getByText(QUOTE)).toHaveCount(0);
  await expect(page.getByText("Un puzzle de gravedad con una idea clarísima")).toBeVisible();
});
