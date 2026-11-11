import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, callRpc, publicProfile } from "./helpers/supabase";

/**
 * Appeals. A new account is suspended; it appeals from the banner, once; an admin keeps the decision and the person reads the answer;
 * after a new decision the person appeals again and the admin reverses it, which lifts the suspension. Suspending and lifting go through
 * the database functions, as the admin panel does.
 */
test.describe.configure({ mode: "serial" });

const ADMIN = { email: "admin@trafal.test", password: "trafal123" };
const PASSWORD = "Trafal12345";

let person: Page;
let admin: Page;
let email = "";
let username = "";
let userId = "";
let adminToken = "";

const appealCard = (page: Page) => page.getByRole("article", { name: `Apelación de @${username}` });

async function suspend(reason: string) {
  const response = await callRpc("suspend_account", { p_user: userId, p_reason: reason }, adminToken);
  expect(response.status).toBeLessThan(300);
}

async function lift() {
  const response = await callRpc("lift_suspension", { p_user: userId, p_reason: "Starting over" }, adminToken);
  expect(response.status).toBeLessThan(300);
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  email = `e2e_appeals_${suffix}@trafal.test`;
  username = `appeals_${lettersOnly(suffix)}`;
  person = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await registerAccount(person, { email, username, displayName: "Persona Apelaciones", password: PASSWORD });
  userId = String((await publicProfile(username, "id")).id);
  admin = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(admin, ADMIN.email, ADMIN.password);
  adminToken = await accessTokenOf(ADMIN.email, ADMIN.password);
});

test.afterAll(async () => {
  await person?.context().close();
  await admin?.context().close();
});

test("sin ninguna decisión sobre la cuenta, la pantalla de moderación lo dice y no ofrece apelar", async () => {
  await gotoReady(person, "/settings/moderation");
  await expect(person.getByRole("heading", { level: 2, name: "Moderación" })).toBeVisible();
  await expect(person.getByText("No hay ninguna decisión vigente sobre tu cuenta ni tu contenido.")).toBeVisible();
  await expect(person.getByRole("button", { name: "Apelar", exact: true })).toHaveCount(0);
  await expect(person.getByText("Todavía no apelaste ninguna decisión.")).toBeVisible();
});

test("una cuenta suspendida apela desde el aviso, con un mensaje, y solo una vez", async () => {
  await suspend("Spam en los comentarios");
  await gotoReady(person, "/");
  await person.getByRole("link", { name: "Apelar la suspensión" }).click();
  await expect(person).toHaveURL(/\/settings\/moderation$/);
  await expect(person.getByText("Tu cuenta está suspendida", { exact: true })).toBeVisible();
  await expect(person.getByRole("main").getByText("Motivo: Spam en los comentarios").first()).toBeVisible();

  await person.getByRole("button", { name: "Apelar", exact: true }).click();
  const dialog = person.getByRole("dialog", { name: "Apelar esta decisión" });
  const send = dialog.getByRole("button", { name: "Enviar apelación" });
  await expect(send).toBeDisabled();
  await dialog.getByLabel("Tu mensaje").fill("Fue un malentendido: eran enlaces a mi propio juego.");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(person.getByRole("dialog")).toHaveCount(0);

  await expect(person.getByText("Apelación en revisión")).toBeVisible();
  await expect(person.getByRole("button", { name: "Apelar", exact: true })).toHaveCount(0);
  await expect(person.getByRole("main").getByText("Fue un malentendido: eran enlaces a mi propio juego.")).toBeVisible();

  const again = await callRpc("submit_appeal", { p_target_type: "profile", p_target_id: userId, p_message: "Otra vez" }, await accessTokenOf(email, PASSWORD));
  expect(again.status).toBeGreaterThanOrEqual(400);
  expect(JSON.stringify(again.body)).toContain("already_appealed");
});

test("el admin ve la apelación, y para responder tiene que escribir una respuesta: la decisión se mantiene", async () => {
  await gotoReady(admin, "/admin/appeals");
  await expect(admin.getByRole("heading", { level: 2, name: "Apelaciones" })).toBeVisible();
  const card = appealCard(admin);
  await expect(card).toBeVisible();
  await expect(card.getByText("Fue un malentendido: eran enlaces a mi propio juego.")).toBeVisible();
  await expect(card.getByText("Suspensión de la cuenta")).toBeVisible();

  await card.getByRole("button", { name: "Mantener la decisión" }).click();
  const dialog = admin.getByRole("dialog", { name: "Mantener la decisión" });
  const confirm = dialog.getByRole("button", { name: "Confirmar" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Respuesta/).fill("Los enlaces eran de afiliados, no de tu juego.");
  await confirm.click();
  await expect(admin.getByRole("dialog")).toHaveCount(0);
  await expect(appealCard(admin)).toHaveCount(0);

  await gotoReady(admin, "/admin/appeals?status=resolved");
  await expect(appealCard(admin).getByText("Se mantuvo la decisión")).toBeVisible();
  await expect(appealCard(admin).getByText("Respuesta: Los enlaces eran de afiliados, no de tu juego.")).toBeVisible();
});

test("la persona lee la respuesta, la cuenta sigue suspendida y no puede apelar lo mismo otra vez", async () => {
  await gotoReady(person, "/notifications");
  await expect(person.getByText("Revisamos tu apelación: se mantuvo la decisión")).toBeVisible();
  await expect(person.getByText("Respuesta: Los enlaces eran de afiliados, no de tu juego.")).toBeVisible();

  await gotoReady(person, "/settings/moderation");
  await expect(person.getByText("Apelación respondida: se mantuvo la decisión")).toBeVisible();
  await expect(person.getByRole("main").getByText("Los enlaces eran de afiliados, no de tu juego.")).toBeVisible();
  await expect(person.getByRole("button", { name: "Apelar", exact: true })).toHaveCount(0);
  await expect(person.getByRole("status", { name: "Tu cuenta está suspendida" })).toBeVisible();
});

test("una decisión nueva se puede apelar, y si el admin la revierte se levanta la suspensión", async () => {
  await lift();
  await suspend("Segundo aviso");
  await gotoReady(person, "/settings/moderation");
  await expect(person.getByRole("main").getByText("Motivo: Segundo aviso").first()).toBeVisible();
  await person.getByRole("button", { name: "Apelar", exact: true }).click();
  const dialog = person.getByRole("dialog", { name: "Apelar esta decisión" });
  await dialog.getByLabel("Tu mensaje").fill("Esta vez tampoco corresponde.");
  await dialog.getByRole("button", { name: "Enviar apelación" }).click();
  await expect(person.getByRole("dialog")).toHaveCount(0);
  await expect(person.getByText("Apelación en revisión")).toBeVisible();

  await gotoReady(admin, "/admin/appeals");
  const card = appealCard(admin);
  await expect(card.getByText("Esta vez tampoco corresponde.")).toBeVisible();
  await card.getByRole("button", { name: "Revertir la decisión" }).click();
  const answer = admin.getByRole("dialog", { name: "Revertir la decisión" });
  await expect(answer.getByText("Se levanta la suspensión de la cuenta.")).toBeVisible();
  await answer.getByLabel(/Respuesta/).fill("Tenés razón, perdón.");
  await answer.getByRole("button", { name: "Confirmar" }).click();
  await expect(admin.getByRole("dialog")).toHaveCount(0);

  await gotoReady(person, "/");
  await expect(person.getByRole("status", { name: "Tu cuenta está suspendida" })).toHaveCount(0);
  await gotoReady(person, "/notifications");
  await expect(person.getByText("Revisamos tu apelación: revertimos la decisión")).toBeVisible();
  await expect(person.getByText("Respuesta: Tenés razón, perdón.")).toBeVisible();
});

test("quien no es admin no ve la cola de apelaciones: la pantalla no existe para esa persona", async () => {
  await person.goto("/admin/appeals");
  await expect(person.getByRole("heading", { level: 2, name: "Apelaciones" })).toHaveCount(0);
  await expect(person.getByText(/Fue un malentendido|Esta vez tampoco/)).toHaveCount(0);
  await expect(person.getByRole("heading", { level: 1, name: /no encontr|404/i })).toBeVisible();
});
