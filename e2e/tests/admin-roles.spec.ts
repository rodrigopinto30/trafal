import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";

/**
 * Naming admins from Administración → Cuentas: the example admin names a new account, which is told and can open the admin area,
 * and then takes the role away. Everything is in the moderation log. The new account always ends as an ordinary one.
 */
test.describe.configure({ mode: "serial" });

let person: Page;
let admin: Page;
let username = "";

function card(query = username) {
  return admin.getByRole("article", { name: `@${query}` });
}

async function openAccount(query: string) {
  await gotoReady(admin, `/admin/accounts?q=${encodeURIComponent(query)}`);
  await expect(card(query)).toBeVisible();
}

async function confirmRole(button: RegExp, title: string, reason: string, done: string) {
  await card().getByRole("button", { name: button }).click();
  const dialog = admin.getByRole("dialog", { name: title });
  await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await dialog.getByLabel(/Motivo/).fill(reason);
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(admin.getByText(done)).toBeVisible();
  await expect(admin.getByRole("dialog")).toHaveCount(0);
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  username = `newadmin_${lettersOnly(suffix)}`;
  person = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await registerAccount(person, { email: `e2e_newadmin_${suffix}@tradfal.test`, username, displayName: "Persona Del Equipo" });
  admin = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(admin, "admin@tradfal.test", "tradfal123");
});

test.afterAll(async () => {
  await openAccount(username);
  const revoke = card().getByRole("button", { name: /Quitar admin/ });
  if (await revoke.isVisible().catch(() => false)) await confirmRole(/Quitar admin/, `Quitarle el rol de admin a @${username}`, "Limpieza de la prueba", "Ya no es parte de la administración");
  await person?.context().close();
  await admin?.context().close();
});

test("una cuenta común no entra a la administración", async () => {
  await gotoReady(person, "/admin/accounts");
  await expect(person.getByRole("heading", { name: "Cuentas" })).toHaveCount(0);
});

test("la administración suma una cuenta con un motivo, y queda en el registro", async () => {
  await openAccount(username);
  await expect(card().getByText("Administración", { exact: true })).toHaveCount(0);
  await confirmRole(/Hacer admin/, `Sumar a @${username} a la administración`, "Se suma al equipo de moderación", "Ahora es parte de la administración");

  await expect(card().getByText("Administración", { exact: true })).toBeVisible();
  await expect(card().getByRole("button", { name: /Quitar admin/ })).toBeVisible();
  await expect(card().getByRole("button", { name: /Suspender/ }), "a la administración no se la suspende").toHaveCount(0);

  await gotoReady(admin, "/admin/accounts?filter=admins");
  await expect(card()).toBeVisible();
  await expect(card("equipo_tradfal")).toBeVisible();

  await gotoReady(admin, "/admin/log");
  await expect(admin.getByText("Sumó una cuenta a la administración").first()).toBeVisible();
});

test("la cuenta nueva se entera y puede abrir la administración", async () => {
  await gotoReady(person, "/notifications");
  await expect(person.getByText("Motivo: Se suma al equipo de moderación")).toBeVisible();
  await expect(person.getByRole("link", { name: "Apelar esta decisión" })).toHaveCount(0);
  await person.getByRole("link", { name: "Te sumamos a la administración de Tradfal" }).click();
  await expect(person).toHaveURL(/\/admin$/);

  await gotoReady(person, "/admin/accounts");
  await expect(person.getByRole("heading", { name: "Cuentas" })).toBeVisible();
});

test("al quitarle el rol vuelve a ser una cuenta común", async () => {
  await openAccount(username);
  await confirmRole(/Quitar admin/, `Quitarle el rol de admin a @${username}`, "Deja el equipo", "Ya no es parte de la administración");
  await expect(card().getByText("Administración", { exact: true })).toHaveCount(0);
  await expect(card().getByRole("button", { name: /Hacer admin/ })).toBeVisible();

  await gotoReady(person, "/notifications");
  await expect(person.getByText("Ya no sos parte de la administración de Tradfal")).toBeVisible();
  await gotoReady(person, "/admin/accounts");
  await expect(person.getByRole("heading", { name: "Cuentas" })).toHaveCount(0);
});
