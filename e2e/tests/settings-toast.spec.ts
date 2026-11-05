import { expect, test, type Locator, type Page } from "@playwright/test";
import { lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";

/**
 * El aviso «Cambios guardados» aparece al guardar y solo entonces. Next conserva las pantallas ya visitadas y, al volver
 * a ellas con atrás/adelante, vuelve a ejecutar sus efectos: un guardado viejo no debe disparar el aviso otra vez.
 * El conteo se lee una sola vez (sin reintentos): un aviso repetido dura unos segundos y un reintento lo dejaría pasar.
 * Tras guardar se aparta el cursor: el aviso aparece justo encima del botón y, con el cursor encima, Sonner pausa su cuenta regresiva.
 */
async function leaveToastAlone(page: Page) {
  await page.mouse.move(0, 0);
}

async function expectNoToastNow(toast: Locator) {
  await toast.page().waitForTimeout(1500);
  expect(await toast.count()).toBe(0);
}

test("«Cambios guardados» no reaparece al volver a Editar perfil sin guardar nada", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const username = `toast_${lettersOnly(suffix)}`;
  await registerAccount(page, { email: `e2e_toast_${suffix}@trafal.test`, username, displayName: "Persona Toast" });

  await page.getByRole("link", { name: "Editar perfil" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await page.getByLabel("Bio").fill("Una bio para guardar.");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toHaveText(/Cambios guardados/);
  await leaveToastAlone(page);
  await expect(toast).toHaveCount(0, { timeout: 15_000 });

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/u/${username}$`));
  await page.waitForTimeout(500);
  await page.goForward();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expectNoToastNow(toast);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/u/${username}$`));
  await page.getByRole("link", { name: "Editar perfil" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByLabel("Bio")).toHaveValue("Una bio para guardar.");
  await expectNoToastNow(toast);
});

test("«Preferencias guardadas» tampoco reaparece al volver sin guardar", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const username = `toastp_${lettersOnly(suffix)}`;
  await registerAccount(page, { email: `e2e_toastp_${suffix}@trafal.test`, username, displayName: "Persona Toast" });

  await page.getByRole("link", { name: "Editar perfil" }).click();
  await page.getByRole("link", { name: "Preferencias" }).click();
  await expect(page).toHaveURL(/\/settings\/preferences$/);
  await page.getByRole("button", { name: "Guardar preferencias" }).click();
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toHaveText(/Preferencias guardadas/);
  await leaveToastAlone(page);
  await expect(toast).toHaveCount(0, { timeout: 15_000 });

  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await page.waitForTimeout(500);
  await page.goForward();
  await expect(page).toHaveURL(/\/settings\/preferences$/);
  await expectNoToastNow(toast);
});
