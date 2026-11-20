import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, loginWith, logout, registerAccount, uniqueSuffix } from "./helpers/session";

/**
 * Changing the password from Settings → Account: it asks for the current one (an open session is not enough), the new one follows
 * the sign-up rules, the person stays signed in on this device and every other session of the account is closed.
 */
test.describe.configure({ mode: "serial" });

const OLD = "Tradfal12345";
const NEW = "Cambiada6789";

let page: Page;
let email = "";

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  page = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  email = `e2e_password_${suffix}@tradfal.test`;
  await registerAccount(page, { email, username: `clave_${lettersOnly(suffix)}`, displayName: "Persona Con Clave Nueva", password: OLD });
});

test.afterAll(async () => {
  await page?.context().close();
});

function form() {
  const section = page.getByRole("region", { name: "Contraseña" });
  return {
    section,
    current: section.getByLabel("Contraseña actual", { exact: true }),
    next: section.getByLabel("Contraseña nueva", { exact: true }),
    confirm: section.getByLabel("Repetí la contraseña nueva", { exact: true }),
    submit: section.getByRole("button", { name: "Cambiar contraseña" }),
  };
}

test("pide la contraseña actual y que la nueva sea válida, distinta y repetida igual", async () => {
  await gotoReady(page, "/settings/account");
  const { section, current, next, confirm, submit } = form();
  await expect(section).toBeVisible();
  await expect(current).toHaveAttribute("autocomplete", "current-password");
  await expect(next).toHaveAttribute("autocomplete", "new-password");

  await submit.click();
  await expect(section.getByText("Escribí tu contraseña actual.")).toBeVisible();

  await current.fill("NoEsLaMia123");
  await next.fill(NEW);
  await confirm.fill(NEW);
  await submit.click();
  await expect(section.getByText("Esa no es tu contraseña actual.")).toBeVisible();

  await current.fill(OLD);
  await next.fill("corta1");
  await confirm.fill("corta1");
  await submit.click();
  await expect(section.getByText("La contraseña nueva es muy débil.", { exact: false })).toBeVisible();

  await next.fill(NEW);
  await confirm.fill("Otra12345");
  await submit.click();
  await expect(section.getByText("Las contraseñas no coinciden.")).toBeVisible();

  await next.fill(OLD);
  await confirm.fill(OLD);
  await submit.click();
  await expect(section.getByText("La contraseña nueva tiene que ser distinta de la actual.")).toBeVisible();
});

test("la cambia, deja la sesión abierta en este dispositivo y cierra la de los demás", async ({ browser }, testInfo) => {
  const elsewhere = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(elsewhere, email, OLD);
  await gotoReady(elsewhere, "/settings/profile");
  await expect(elsewhere).toHaveURL(/\/settings\/profile$/);

  await gotoReady(page, "/settings/account");
  const { current, next, confirm, submit } = form();
  await current.fill(OLD);
  await next.fill(NEW);
  await confirm.fill(NEW);
  await submit.click();
  await expect(page.getByText("¡Contraseña cambiada! Cerramos tu sesión en los demás dispositivos.")).toBeVisible();
  await expect(current).toHaveValue("");
  await expect(next).toHaveValue("");

  await gotoReady(page, "/settings/profile");
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByRole("heading", { level: 2, name: "Editar perfil" })).toBeVisible();

  await elsewhere.goto("/settings/profile");
  await expect(elsewhere).toHaveURL(/\/login\?next=%2Fsettings%2Fprofile/);
  await elsewhere.context().close();
});

test("después solo entra con la contraseña nueva", async () => {
  await logout(page);
  await loginWith(page, email, OLD);
  await expect(page.getByText("El email o la contraseña no coinciden.")).toBeVisible();

  await loginAndWait(page, email, NEW);
  await gotoReady(page, "/settings/account");
  await expect(form().section).toBeVisible();
});
