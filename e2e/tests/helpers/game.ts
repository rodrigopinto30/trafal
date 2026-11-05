import { expect, type Page } from "@playwright/test";
import { gotoReady } from "./session";

/** Fills the "upload a game" form with the minimum required details and the given zip, and submits it. */
export async function uploadGameZip(page: Page, title: string, zip: Buffer, fileName = "game.zip") {
  await gotoReady(page, "/games/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descripción corta").fill("Un juego de prueba.");
  await page.getByLabel("Género").selectOption("arcade");
  await page.getByLabel("Motor").selectOption("other");
  await page.getByLabel("Archivo .zip del juego").setInputFiles({ name: fileName, mimeType: "application/zip", buffer: zip });
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page).toHaveURL(/\/games\/[a-z0-9]+\/manage$/, { timeout: 60_000 });
}
