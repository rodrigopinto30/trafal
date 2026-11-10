import { expect, test, type Page } from "@playwright/test";
import { makePng } from "./helpers/images";
import { gotoReady, lettersOnly, loginAndWait, loginWith, registerAccount, uniqueSuffix } from "./helpers/session";
import { accessTokenOf, callRpc, publicProfile } from "./helpers/supabase";

/**
 * Deleting an account: the person types their @username to confirm, and then the sign-in, the profile, what they published and
 * their files in storage are all gone. One new account publishes a photo and an update with an image, and deletes itself. The
 * database function refuses admins and visitors.
 */
test.describe.configure({ mode: "serial" });

const PASSWORD = "Trafal12345";
const PHOTO_URL = "img[src*='/storage/v1/object/public/media/avatars/']";

let page: Page;
let email = "";
let username = "";
let photoUrl = "";
let updateImageUrl = "";

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ ...testInfo.project.use });
  page = await context.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  email = `e2e_leaving_${suffix}@trafal.test`;
  username = `leaving_${lettersOnly(suffix)}`;
  await registerAccount(page, { email, username, displayName: "Persona Que Se Va", password: PASSWORD });
});

test.afterAll(async () => {
  await page?.context().close();
});

test("la cuenta sube una foto y publica un avance con una imagen", async () => {
  await gotoReady(page, "/settings/profile");
  await page.getByTestId("avatar-file").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: makePng(300, 300) });
  await page.getByRole("dialog", { name: "Ajustá tu foto" }).getByRole("button", { name: "Guardar foto" }).click();
  await expect(page.getByText("¡Foto actualizada!")).toBeVisible();
  photoUrl = (await page.locator(PHOTO_URL).first().getAttribute("src")) ?? "";
  expect((await page.request.get(photoUrl)).status()).toBe(200);

  await gotoReady(page, "/posts/new");
  await page.getByLabel("Qué querés contar").fill("Un avance que se va con la cuenta.");
  await page.getByLabel("Elegir archivos").setInputFiles({ name: "captura.png", mimeType: "image/png", buffer: makePng(64, 48) });
  await page.getByLabel("Descripción de captura.png (opcional)").fill("Captura que se va con la cuenta");
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${username}$`), { timeout: 30_000 });
  await page.getByRole("tab", { name: "Avances" }).click();
  updateImageUrl = (await page.getByRole("img", { name: "Captura que se va con la cuenta" }).getAttribute("src")) ?? "";
  expect((await page.request.get(updateImageUrl)).status()).toBe(200);
});

test("la pestaña Cuenta pide escribir el usuario, y cancelar no borra nada", async () => {
  await gotoReady(page, "/settings/account");
  await expect(page.getByRole("heading", { level: 2, name: "Cuenta" })).toBeVisible();
  await expect(page.getByText("Se borra para siempre:")).toBeVisible();
  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();

  const dialog = page.getByRole("dialog", { name: "¿Eliminar tu cuenta?" });
  const confirm = dialog.getByRole("button", { name: "Eliminar para siempre" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(`Para confirmar, escribí tu usuario: ${username}`).fill("otro_usuario");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Para confirmar/).fill(`@${username}`);
  await expect(confirm).toBeEnabled();

  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await publicProfile(username, "username")).username).toBe(username);
  expect((await page.request.get(photoUrl)).status()).toBe(200);
});

test("el servidor vuelve a comprobar el usuario aunque se fuerce el botón", async () => {
  await gotoReady(page, "/settings/account");
  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  const dialog = page.getByRole("dialog", { name: "¿Eliminar tu cuenta?" });
  await dialog.getByLabel(/Para confirmar/).fill("otro_usuario");
  await dialog.getByRole("button", { name: "Eliminar para siempre" }).evaluate((button) => (button as HTMLButtonElement).removeAttribute("disabled"));
  await dialog.getByRole("button", { name: "Eliminar para siempre" }).click();
  await expect(dialog.getByText("Ese no es tu usuario")).toBeVisible();
  expect((await publicProfile(username, "username")).username).toBe(username);
  await page.keyboard.press("Escape");
});

test("se confirma el usuario y la cuenta, lo publicado y los archivos desaparecen", async () => {
  await gotoReady(page, "/settings/account");
  await page.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  const dialog = page.getByRole("dialog", { name: "¿Eliminar tu cuenta?" });
  await dialog.getByLabel(/Para confirmar/).fill(username);
  await dialog.getByRole("button", { name: "Eliminar para siempre" }).click();

  await expect(page).toHaveURL(/\/account-deleted$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Eliminamos tu cuenta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir al inicio", exact: true })).toHaveAttribute("href", "/");

  await expect(publicProfile(username, "username")).rejects.toThrow("No existe el perfil");
  await page.goto(`/u/${username}`);
  await expect(page.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
  expect((await page.request.get(photoUrl)).status(), "la foto ya no está").toBeGreaterThanOrEqual(400);
  expect((await page.request.get(updateImageUrl)).status(), "ni la imagen del avance").toBeGreaterThanOrEqual(400);

  await page.goto("/settings/account");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Faccount/);
});

test("ya no se puede iniciar sesión con esa cuenta", async () => {
  await loginWith(page, email, PASSWORD);
  await expect(page.getByRole("alert").filter({ hasText: "El email o la contraseña no coinciden." })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("la administración no ve el botón, y la base rechaza a admins y a visitantes", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const admin = await context.newPage();
  await loginAndWait(admin, "admin@trafal.test", "trafal123");
  await gotoReady(admin, "/settings/account");
  await expect(admin.getByText("Las cuentas de administración no se pueden eliminar desde acá.")).toBeVisible();
  await expect(admin.getByRole("button", { name: "Eliminar mi cuenta" })).toHaveCount(0);
  await context.close();

  const adminToken = await accessTokenOf("admin@trafal.test", "trafal123");
  const refused = await callRpc("delete_my_account", {}, adminToken);
  expect(refused.status).toBe(400);
  expect(JSON.stringify(refused.body)).toContain("admin_cannot_delete");
  expect((await callRpc("delete_my_account", {})).status).toBeGreaterThanOrEqual(400);
  expect((await callRpc("account_files", {})).status).toBeGreaterThanOrEqual(400);
  expect((await publicProfile("equipo_trafal", "username")).username).toBe("equipo_trafal");
});
