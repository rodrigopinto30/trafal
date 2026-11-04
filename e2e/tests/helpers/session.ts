import { expect, type Page } from "@playwright/test";
import { confirmationLink, waitForEmailHtml } from "./mailpit";

/**
 * Navega y espera a que la página termine de cargar e hidratar. Los formularios llegan por streaming: si un
 * test escribe antes de que React hidrate, la hidratación repone el valor inicial y el texto se pierde (le pasaría
 * igual a quien teclee a toda velocidad en una conexión lenta).
 */
export async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Cierra la sesión desde el menú de la cuenta (escritorio) o desde el menú hamburguesa (celular). */
export async function logout(page: Page) {
  const account = page.getByRole("button", { name: "Tu cuenta" });
  const burger = page.getByRole("button", { name: "Abrir menú" });
  // En el menú desplegable el ítem es un «menuitem»; en el menú móvil, un botón común.
  const logoutItem = page.getByRole("menuitem", { name: "Cerrar sesión" }).or(page.getByRole("button", { name: "Cerrar sesión" }));

  // La zona de la cuenta llega por streaming: esperar a que aparezca alguno de los dos antes de decidir.
  await expect(account.or(burger).first()).toBeVisible();
  // Un clic antes de que React hidrate el botón se pierde: se reintenta hasta que el menú realmente se abra.
  await expect(async () => {
    if (!(await logoutItem.isVisible())) {
      if (await account.isVisible()) await account.click();
      else await burger.click();
    }
    await expect(logoutItem).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  await logoutItem.click();
  await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();
}

export async function loginWith(page: Page, email: string, password: string) {
  await gotoReady(page, "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

/** Inicia sesión y espera a que termine (sale de /login). Úsalo cuando el test sigue navegando después. */
export async function loginAndWait(page: Page, email: string, password: string) {
  await loginWith(page, email, password);
  await expect(page).not.toHaveURL(/\/login/);
}

/** Identificador corto y único por corrida y proyecto, para no chocar con cuentas de corridas anteriores. */
export function uniqueSuffix(projectName: string) {
  const stamp = Date.now().toString(36).slice(-6);
  return `${projectName === "desktop" ? "d" : "m"}${stamp}`;
}

/** Un @usuario único SIN números (el sufijo en base 36 trae dígitos: se pasan a letras). Sirve para probar que no hacen falta. */
export function lettersOnly(suffix: string) {
  return suffix.replace(/\d/g, (digit) => "abcdefghij"[Number(digit)] as string);
}

/**
 * Crea una cuenta nueva por la interfaz (registro → mail de confirmación → onboarding) y deja la sesión iniciada en su
 * perfil. Las cuentas «e2e_*» se borran solas al terminar la corrida (e2e/run.sh).
 */
export async function registerAccount(
  page: Page,
  account: { email: string; username: string; displayName: string; password?: string },
) {
  const password = account.password ?? "Trafal12345";
  await gotoReady(page, "/signup");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetí la contraseña").fill(password);
  await page.getByRole("checkbox", { name: /18 años o más/ }).check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Revisá tu email" })).toBeVisible();

  await page.goto(confirmationLink(await waitForEmailHtml(account.email)));
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("Tu @usuario").fill(account.username);
  await expect(page.getByText("¡Está libre!")).toBeVisible();
  await page.getByLabel("Tu nombre").fill(account.displayName);
  await page.getByRole("button", { name: "Entrar a Trafal" }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${account.username}$`));
}
