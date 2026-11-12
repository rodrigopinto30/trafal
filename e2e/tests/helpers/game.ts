import { expect, type Page } from "@playwright/test";
import { gotoReady } from "./session";

/** Fills the "upload a game" form with the minimum required details, the given zip and optional questions for the players, and submits it. */
export async function uploadGameZip(page: Page, title: string, zip: Buffer, fileName = "game.zip", questions: string[] = []) {
  await gotoReady(page, "/games/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descripción corta").fill("Un juego de prueba.");
  await page.getByLabel("Género").selectOption("arcade");
  for (const [index, question] of questions.entries()) await page.getByLabel(`Pregunta ${index + 1}`).fill(question);
  await page.getByLabel("Archivo .zip del juego").setInputFiles({ name: fileName, mimeType: "application/zip", buffer: zip });
  await page.getByRole("button", { name: "Subir juego" }).click();
  await expect(page).toHaveURL(/\/games\/[a-z0-9]+\/manage$/, { timeout: 60_000 });
}

/** Takes a published game back to a draft, so the games a test published do not crowd the landing page for the tests that run after it. */
export async function unpublishGame(page: Page, publicId: string) {
  await gotoReady(page, `/games/${publicId}/manage`);
  const button = page.getByRole("button", { name: "Volver a borrador" });
  if (!(await button.isVisible())) return;
  await button.click();
  await expect(page.getByText("Tu juego pasó la revisión y sigue siendo un borrador")).toBeVisible();
}
