import { expect, type Page } from "@playwright/test";
import { gotoReady } from "./session";

/** A game name nobody has: names are unique on Trafal, and every project of a run uploads its own copy of each game. */
export function uniqueTitle(base: string) {
  return `${base} ${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}`;
}

/** Fills the "upload a game" form with the minimum required details, the given zip and optional questions for the players, and submits it. */
export async function submitGameZip(page: Page, title: string, zip: Buffer, fileName = "game.zip", questions: string[] = []) {
  await gotoReady(page, "/games/new");
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descripción corta").fill("Un juego de prueba.");
  await page.getByLabel("Género").selectOption("arcade");
  for (const [index, question] of questions.entries()) await page.getByLabel(`Pregunta ${index + 1}`).fill(question);
  await page.getByLabel("Archivo .zip del juego").setInputFiles({ name: fileName, mimeType: "application/zip", buffer: zip });
  await page.getByRole("button", { name: "Subir juego" }).click();
}

/** The address of a game's page (and not the upload form at /games/new, which has the same shape). */
export const GAME_PAGE_URL = /\/games\/(?!new$)[a-z0-9-]+$/;

/** The public id of the game whose page is open. */
export function publicIdOf(page: Page) {
  return /\/games\/([a-z0-9-]+)$/.exec(new URL(page.url()).pathname)?.[1] ?? "";
}

/** Uploads a game and waits until its zip passed the review: the form then takes the owner to the game's page. Returns its public id. */
export async function uploadGameZip(page: Page, title: string, zip: Buffer, fileName = "game.zip", questions: string[] = []) {
  await submitGameZip(page, title, zip, fileName, questions);
  await expect(page).toHaveURL(GAME_PAGE_URL, { timeout: 90_000 });
  const publicId = publicIdOf(page);
  expect(publicId).not.toBe("");
  return publicId;
}

/** Uploads a game and publishes it from the dialog that greets the owner on its page. Returns its public id. */
export async function uploadAndPublishGame(page: Page, title: string, zip: Buffer, fileName = "game.zip", questions: string[] = []) {
  const publicId = await uploadGameZip(page, title, zip, fileName, questions);
  const dialog = page.getByRole("dialog", { name: "¡Tu juego está listo!" });
  await dialog.getByRole("button", { name: "Publicar juego" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Está publicado: cualquiera lo puede ver y jugar en Trafal.")).toBeVisible();
  return publicId;
}

/** Takes a published game back to a draft from its page, so the games a test published do not crowd the landing page for the tests that run after it. */
export async function unpublishGame(page: Page, publicId: string) {
  await gotoReady(page, `/games/${publicId}`);
  const button = page.getByRole("region", { name: "Tu juego" }).getByRole("button", { name: "Bajar juego" });
  if (!(await button.isVisible())) return;
  await button.click();
  await page.getByRole("dialog", { name: "¿Bajar tu juego?" }).getByRole("button", { name: "Bajar juego" }).click();
  await expect(page.getByText("Pasó la revisión. Por ahora es un borrador")).toBeVisible();
}
