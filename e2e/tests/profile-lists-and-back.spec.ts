import { expect, test } from "@playwright/test";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";
import { followsPerson } from "./helpers/supabase";

/**
 * Three details of moving around and editing: the favorite genres stay marked after saving (React 19 resets the form when the action
 * ends), every section has a Back button, and the lists of followers and followed have a follow / unfollow button on each person.
 */
const VALEN = { email: "valen@trafal.test", password: "trafal123", username: "valen_makes" };

test("los géneros y los motores elegidos quedan marcados al guardar, sin recargar, y después de recargar", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(page, { email: `e2e_genres_${suffix}@trafal.test`, username: `genres_${lettersOnly(suffix)}`, displayName: "Persona Géneros" });
  await gotoReady(page, "/settings/profile");

  const arcade = page.getByRole("checkbox", { name: "Arcade" });
  const puzzle = page.getByRole("checkbox", { name: "Puzzle" });
  const phaser = page.getByRole("checkbox", { name: "Phaser" });
  const tile = (name: string) => page.locator("label").filter({ hasText: new RegExp(`^${name}$`) });
  await tile("Arcade").click();
  await tile("Puzzle").click();
  await tile("Phaser").click();
  await expect(arcade).toBeChecked();
  await expect(page.getByText("Elegiste 2 géneros.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.locator("[data-sonner-toast]")).toHaveText(/Cambios guardados/);

  await expect(arcade).toBeChecked();
  await expect(puzzle).toBeChecked();
  await expect(phaser).toBeChecked();
  await expect(page.getByText("Elegiste 2 géneros.")).toBeVisible();

  await tile("Puzzle").click();
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.locator("[data-sonner-toast]")).toHaveText(/Cambios guardados/);
  await expect(puzzle).not.toBeChecked();
  await expect(arcade).toBeChecked();

  await gotoReady(page, "/settings/profile");
  await expect(arcade).toBeChecked();
  await expect(puzzle).not.toBeChecked();
  await expect(phaser).toBeChecked();
});

test("cada sección tiene el botón «Atrás»: vuelve a la pantalla anterior, y abierta directamente lleva a la portada", async ({ page, browser }, testInfo) => {
  await gotoReady(page, "/");
  await expect(page.getByRole("button", { name: "Atrás" })).toHaveCount(0);

  await page.getByRole("contentinfo").getByRole("link", { name: "Creadores" }).click();
  await expect(page).toHaveURL(/\/creators$/);
  const back = page.getByRole("button", { name: "Atrás" });
  await expect(back).toBeVisible();
  expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(page).toHaveURL(/localhost:3000\/$/);

  const direct = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await gotoReady(direct, "/legal/terms");
  await direct.getByRole("button", { name: "Atrás" }).click();
  await expect(direct).toHaveURL(/localhost:3000\/$/);
  await direct.context().close();
});

test("en inglés el botón dice «Back»", async ({ page }) => {
  await gotoReady(page, "/en/creators");
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
});

test("las listas de seguidos y de seguidores tienen el botón de seguir y dejar de seguir en cada persona", async ({ page }) => {
  await loginAndWait(page, VALEN.email, VALEN.password);
  await gotoReady(page, `/u/${VALEN.username}/following`);

  const mateo = page.getByRole("article").filter({ hasText: "@mateo_g" });
  const unfollow = mateo.getByRole("button", { name: "Dejar de seguir a @mateo_g" });
  await expect(unfollow).toBeVisible();
  await expect(unfollow).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article").filter({ hasText: "@valen_makes" })).toHaveCount(0);

  await unfollow.click();
  const follow = mateo.getByRole("button", { name: "Seguir a @mateo_g" });
  await expect(follow).toBeVisible();
  await expect(mateo).toBeVisible();
  await expect.poll(() => followsPerson(VALEN.username, "mateo_g")).toBe(false);

  await follow.click();
  await expect(mateo.getByRole("button", { name: "Dejar de seguir a @mateo_g" })).toBeVisible();
  await expect.poll(() => followsPerson(VALEN.username, "mateo_g")).toBe(true);

  await gotoReady(page, `/u/${VALEN.username}/followers`);
  const people = page.getByRole("article");
  expect(await people.count()).toBeGreaterThan(0);
  expect(await people.getByRole("button", { name: /^(Seguir a|Dejar de seguir a) @/ }).count()).toBe(await people.count());
});

test("quien no inició sesión ve «Seguir» en cada persona y lo lleva a iniciar sesión", async ({ page }) => {
  await gotoReady(page, `/u/${VALEN.username}/following`);
  const link = page.getByRole("article").filter({ hasText: "@mateo_g" }).getByRole("link", { name: "Seguir" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /\/login\?next=/);
});
