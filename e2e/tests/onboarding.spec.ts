import { expect, test } from "@playwright/test";
import { confirmationLink, waitForEmailHtml } from "./helpers/mailpit";
import { lettersOnly, logout, uniqueSuffix } from "./helpers/session";
import { signUpWithoutConsent } from "./helpers/supabase";

test("quien llega sin haber aceptado antes (como con Google) confirma 18+ y términos en el onboarding", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const email = `e2e_${suffix}@trafal.test`;
  const username = `sin_casilla_${lettersOnly(suffix)}`;

  await signUpWithoutConsent(email, "Trafal12345");
  await page.goto(confirmationLink(await waitForEmailHtml(email)));
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/onboarding/);

  // No hay constancia previa: se pide acá, con la edad vigente.
  const adult = page.getByRole("checkbox", { name: /18 años o más/ });
  await expect(adult).toBeVisible();
  await expect(adult).not.toBeChecked();

  await page.getByLabel("Tu @usuario").fill(username);
  await expect(page.getByText("¡Está libre!")).toBeVisible();
  await page.getByLabel("Tu nombre").fill("Sin Casilla");

  // Sin la casilla no se entra (lo exige la base de datos, no solo la pantalla).
  await page.getByRole("button", { name: "Entrar a Trafal" }).click();
  await expect(page.getByText("Tenés que confirmar que tenés 18 años o más.")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);

  // Con la casilla tildada pero otro error (nombre vacío): el error es el del nombre y la casilla SIGUE tildada.
  await adult.check();
  await page.getByLabel("Tu nombre").fill("");
  await page.getByRole("button", { name: "Entrar a Trafal" }).click();
  await expect(page.getByText("Escribí tu nombre")).toBeVisible();
  await expect(adult).toBeChecked();
  await expect(page.getByLabel("Tu @usuario")).toHaveValue(username);

  await page.getByLabel("Tu nombre").fill("Sin Casilla");
  await page.getByRole("button", { name: "Entrar a Trafal" }).click();
  await expect(page).toHaveURL(new RegExp(`/u/${username}$`));
  await logout(page);
});
