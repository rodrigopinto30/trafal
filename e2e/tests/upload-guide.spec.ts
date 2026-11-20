import { expect, test } from "@playwright/test";
import { gotoReady, loginAndWait } from "./helpers/session";

/**
 * The upload guide: it is reached from the footer and from the upload form, shows the limits the site really enforces (a game's
 * zip, its single cover and its optional GIF, the uploads a day), jumps to each section from its table of contents and exists in
 * English.
 */
test("el pie lleva a la guía, que muestra los pasos, los límites de verdad y un índice que lleva a cada sección", async ({ page }) => {
  await gotoReady(page, "/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Cómo subir un juego" }).click();
  await expect(page).toHaveURL(/\/help\/upload$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cómo subir un juego" })).toBeVisible();
  await expect(page).toHaveTitle("Tradfal - Cómo subir un juego");

  const steps = page.getByRole("region", { name: "Paso a paso" });
  await expect(steps.getByRole("heading", { level: 3 })).toHaveCount(7);
  await expect(steps.getByRole("heading", { level: 3, name: "Paso 2: Armá el .zip" })).toBeVisible();
  await expect(steps.getByRole("list", { name: "Contenido de mi-juego.zip" })).toHaveCount(3);
  await expect(steps.getByText("El index.html quedó dos carpetas adentro.")).toBeVisible();

  const limits = page.getByRole("region", { name: "Límites" }).getByRole("table");
  await expect(limits.getByRole("row", { name: /El \.zip\s+200 MB/ })).toBeVisible();
  await expect(limits.getByRole("row", { name: /El juego descomprimido\s+1 GB/ })).toBeVisible();
  await expect(limits.getByRole("row", { name: /Subidas por día\s+5/ })).toBeVisible();
  await expect(limits.getByRole("row", { name: /La portada\s+5 MB/ })).toBeVisible();
  await expect(limits.getByRole("row", { name: /El GIF\s+5 MB/ })).toBeVisible();

  const types = page.getByRole("region", { name: "Qué archivos se aceptan" });
  for (const extension of [".html", ".wasm", ".png", ".ogg", ".woff2", ".glb", ".pck"]) await expect(types.getByText(extension, { exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "En esta guía" }).getByRole("link", { name: "Preguntas frecuentes" }).click();
  await expect(page).toHaveURL(/#faq$/);
  const faq = page.getByRole("region", { name: "Preguntas frecuentes" });
  await expect(faq.getByRole("heading", { level: 2 })).toBeInViewport();
  await faq.getByText("¿Quién ve mi juego antes de publicarlo?").click();
  await expect(faq.getByText("Solo vos. Hasta que lo publiques, nadie más puede verlo ni jugarlo.")).toBeVisible();

  await page.getByRole("link", { name: "Subir mi juego" }).first().click();
  await expect(page).toHaveURL(/\/login\?next=%2Fgames%2Fnew/);
});

test("el formulario de subida enlaza a la guía", async ({ page }) => {
  await loginAndWait(page, "valen@tradfal.test", "tradfal123");
  await gotoReady(page, "/games/new");
  await page.getByRole("link", { name: /Mirá la guía paso a paso/ }).click();
  await expect(page).toHaveURL(/\/help\/upload$/);
});

test("existe en inglés", async ({ page }) => {
  await gotoReady(page, "/en/help/upload");
  await expect(page.getByRole("heading", { level: 1, name: "How to upload a game" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Limits" }).getByRole("row", { name: /The \.zip\s+200 MB/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Contents of my-game.zip" })).toHaveCount(3);
});
