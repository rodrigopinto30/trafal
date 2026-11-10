import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";

/**
 * Suspending and reinstating an account from the administration: the person is told why and until when on every page, cannot
 * write while suspended and can again afterwards, administration accounts cannot be suspended, and everything is in the
 * moderation log. One new account is suspended by the example admin and always left active.
 */
test.describe.configure({ mode: "serial" });

const GAME = "/games/orbita";

let person: Page;
let admin: Page;
let suffix = "";
let username = "";

async function openAccount(target: Page, query: string) {
  await gotoReady(target, `/admin/accounts?q=${encodeURIComponent(query)}`);
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  suffix = uniqueSuffix(testInfo.project.name);
  username = `suspended_${lettersOnly(suffix)}`;
  person = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await registerAccount(person, { email: `e2e_suspended_${suffix}@trafal.test`, username, displayName: "Persona Suspendida" });
  admin = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await loginAndWait(admin, "admin@trafal.test", "trafal123");
});

test.afterAll(async () => {
  await openAccount(admin, username);
  const lift = admin.getByRole("article", { name: `@${username}` }).getByRole("button", { name: /Levantar suspensión/ });
  if (await lift.isVisible().catch(() => false)) {
    await lift.click();
    await admin.getByRole("dialog").getByLabel(/Motivo/).fill("Limpieza de la prueba");
    await admin.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(admin.getByText("Suspensión levantada")).toBeVisible();
  }
  await person?.context().close();
  await admin?.context().close();
});

test("la administración no puede suspender a la administración", async () => {
  await openAccount(admin, "equipo_trafal");
  const card = admin.getByRole("article", { name: "@equipo_trafal" });
  await expect(card).toBeVisible();
  await expect(card.getByText("No se puede suspender a la administración")).toBeVisible();
  await expect(card.getByRole("button", { name: /Suspender/ })).toHaveCount(0);
});

test("una persona común no entra a las cuentas de la administración", async () => {
  await gotoReady(person, "/admin/accounts");
  await expect(person.getByRole("heading", { name: "Cuentas" })).toHaveCount(0);
});

test("se encuentra una cuenta por el comienzo de su @usuario o de una palabra de su nombre, y lo raro no rompe nada", async () => {
  await openAccount(admin, username.slice(0, 12));
  await expect(admin.getByRole("article", { name: `@${username}` })).toBeVisible();
  await openAccount(admin, "Suspendida");
  await expect(admin.getByRole("article", { name: `@${username}` })).toBeVisible();
  await openAccount(admin, "%_,()\"'\\");
  await expect(admin.getByRole("heading", { name: "Cuentas" })).toBeVisible();
  await gotoReady(admin, "/admin/accounts?q=zzzzzzzzzz");
  await expect(admin.getByText("No encontramos cuentas con eso")).toBeVisible();
});

test("se suspende una cuenta con motivo y duración", async () => {
  await openAccount(admin, username);
  const card = admin.getByRole("article", { name: `@${username}` });
  await expect(card).toBeVisible();
  await expect(card.getByText("Suspendida", { exact: true })).toHaveCount(0);

  const suspend = card.getByRole("button", { name: /Suspender/ });
  await expect(suspend).toBeEnabled();
  await suspend.click();
  const dialog = admin.getByRole("dialog", { name: `Suspender la cuenta de @${username}` });
  await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await dialog.getByLabel("Duración").selectOption("1");
  await dialog.getByLabel(/Motivo/).fill(`Insultos repetidos ${suffix}`);
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(admin.getByText("Cuenta suspendida")).toBeVisible();

  await expect(card.getByText(/Suspendida hasta el/)).toBeVisible();
  await expect(card.getByText(`Insultos repetidos ${suffix}`)).toBeVisible();
  await gotoReady(admin, "/admin/accounts?filter=suspended");
  await expect(admin.getByRole("article", { name: `@${username}` })).toBeVisible();
});

test("la persona suspendida lo ve en cada página y no puede reportar", async () => {
  await gotoReady(person, "/");
  const banner = person.getByRole("status", { name: "Tu cuenta está suspendida" });
  await expect(banner).toBeVisible();
  await expect(banner.getByText(`Insultos repetidos ${suffix}`)).toBeVisible();
  await expect(banner.getByText(/Hasta el/)).toBeVisible();

  await gotoReady(person, GAME);
  await expect(person.getByRole("status", { name: "Tu cuenta está suspendida" })).toBeVisible();
  await person.getByRole("button", { name: "Reportar", exact: true }).first().click();
  const dialog = person.getByRole("dialog");
  await dialog.getByLabel("Motivo").selectOption("spam");
  await dialog.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(dialog.getByText("Tu cuenta no puede reportar por ahora")).toBeVisible();
  await person.keyboard.press("Escape");
});

test("no se puede suspender dos veces y queda en el registro", async () => {
  await openAccount(admin, username);
  const card = admin.getByRole("article", { name: `@${username}` });
  await expect(card.getByRole("button", { name: /Suspender/ })).toHaveCount(0);

  await gotoReady(admin, "/admin/log");
  await expect(admin.getByRole("row", { name: new RegExp(`Suspendió una cuenta.*Insultos repetidos ${suffix}`) })).toBeVisible();
});

test("al levantar la suspensión la persona vuelve a poder escribir", async () => {
  await openAccount(admin, username);
  const lift = admin.getByRole("article", { name: `@${username}` }).getByRole("button", { name: /Levantar suspensión/ });
  await expect(lift).toBeEnabled();
  await lift.click();
  const dialog = admin.getByRole("dialog", { name: `Levantar la suspensión de @${username}` });
  await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await dialog.getByLabel(/Motivo/).fill(`Fue un malentendido ${suffix}`);
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(admin.getByText("Suspensión levantada")).toBeVisible();

  await gotoReady(person, GAME);
  await expect(person.getByRole("status", { name: "Tu cuenta está suspendida" })).toHaveCount(0);
  await person.getByRole("button", { name: "Reportar", exact: true }).first().click();
  const report = person.getByRole("dialog");
  await report.getByLabel("Motivo").selectOption("spam");
  await report.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(report.getByText("Recibimos tu reporte")).toBeVisible();

  await gotoReady(admin, "/admin/log");
  await expect(admin.getByRole("row", { name: new RegExp(`Levantó una suspensión.*Fue un malentendido ${suffix}`) })).toBeVisible();
});
