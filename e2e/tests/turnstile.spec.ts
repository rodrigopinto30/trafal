import { expect, test } from "@playwright/test";
import { uniqueSuffix } from "./helpers/session";

/**
 * The captcha (Cloudflare Turnstile) in the signup and in the copyright claim form. It needs the keys of the site, so it only runs
 * when the web was started with Cloudflare's published test keys (README → «Captcha») and the mode is given:
 *   E2E_TURNSTILE=pass  site key 1x00000000000000000000AA and secret 1x0000000000000000000000000000000AA (always pass)
 *   E2E_TURNSTILE=fail  the same site key and secret 2x0000000000000000000000000000000AA (the server's check always fails)
 * It talks to Cloudflare for real (the widget in the browser, the check from the server).
 */
const MODE = process.env.E2E_TURNSTILE;

/** The widget keeps the network busy, so «network idle» never comes: the button, enabled only once the captcha is solved, is the signal that the page is ready. (The test keys of Cloudflare solve themselves without showing anything.) */
async function openWithCaptcha(page: import("@playwright/test").Page, path: string, button: RegExp) {
  await page.goto(path);
  const submit = page.getByRole("button", { name: button }).last();
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator("input[name='captchaToken']")).not.toHaveValue("");
  return submit;
}

async function fillClaim(page: import("@playwright/test").Page, email: string) {
  await page.getByLabel("Tu nombre completo", { exact: true }).fill("Carla Titular");
  await page.getByLabel("Email de contacto").fill(email);
  await page.getByLabel("Qué obra es tuya y por qué creés que la copiaron").fill("Una hoja de sprites que dibujé en 2024 y publiqué en mi sitio.");
  await page.getByLabel("Enlaces a lo que reclamás en Trafal").fill("http://localhost:3000/games/colectivo-152");
  await page.getByLabel("Firma (escribí tu nombre completo)").fill("Carla Titular");
  await page.getByLabel(/Creo de buena fe/).check();
  await page.getByLabel(/Declaro que la información/).check();
}
test.skip(MODE !== "pass" && MODE !== "fail", "Se corre con las claves de prueba de Turnstile (E2E_TURNSTILE=pass|fail)");

test("el registro muestra el captcha, espera a que se resuelva y después deja crear la cuenta", async ({ page }, testInfo) => {
  test.skip(MODE !== "pass", "Con la secreta que siempre falla, el registro lo decide Supabase Auth (que acá no tiene el captcha activado)");
  const submit = await openWithCaptcha(page, "/signup", /Crear cuenta/);
  const suffix = uniqueSuffix(testInfo.project.name);
  await page.getByLabel("Email").fill(`e2e_captcha_${suffix}@trafal.test`);
  await page.getByLabel("Contraseña", { exact: true }).fill("Trafal12345");
  await page.getByLabel("Repetí la contraseña").fill("Trafal12345");
  await page.getByRole("checkbox", { name: /18 años o más/ }).check();
  await submit.click();
  await expect(page.getByRole("heading", { name: "Revisá tu email" })).toBeVisible();
});

test("el formulario de reclamos no deja enviar hasta que el captcha está resuelto", async ({ page }) => {
  await openWithCaptcha(page, "/legal/copyright/claim", /Enviar reclamo/);
});

test("el servidor comprueba el captcha: con la secreta que siempre falla, el reclamo no se envía", async ({ page }) => {
  test.skip(MODE !== "fail", "Solo con la secreta que siempre falla");
  const submit = await openWithCaptcha(page, "/legal/copyright/claim", /Enviar reclamo/);
  await fillClaim(page, "e2e_claim_captcha@trafal.test");
  await submit.click();
  await expect(page.getByText("No pudimos comprobar que sos una persona.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recibimos tu reclamo" })).toHaveCount(0);
});

test("el reclamo con el captcha resuelto se envía", async ({ page }, testInfo) => {
  test.skip(MODE !== "pass", "Solo con la secreta que siempre pasa");
  const submit = await openWithCaptcha(page, "/legal/copyright/claim", /Enviar reclamo/);
  await fillClaim(page, `e2e_claim_captcha_${uniqueSuffix(testInfo.project.name)}@trafal.test`);
  await submit.click();
  await expect(page.getByRole("heading", { name: "Recibimos tu reclamo" })).toBeVisible();
});
