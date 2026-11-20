import { expect, test } from "@playwright/test";
import { GAME_PAGE_URL, submitGameZip, uniqueTitle } from "./helpers/game";
import { lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { makeZip, validGameZip } from "./helpers/zip";

/**
 * The worker takes each uploaded zip from the queue, validates it and either publishes its files (version «Lista») or rejects
 * it with an error the owner can understand. These tests go through the real pipeline: form → quarantine → worker → the form,
 * which waits for the review and shows the reason next to its button.
 */
const HTML = "<!doctype html><title>x</title><script src=game.js></script>";
const ELF = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(100)]);

const REJECTED_ZIPS = [
  {
    name: "una ruta que escapa de la carpeta",
    zip: () => makeZip({ "index.html": HTML, "../../evil.html": "x" }),
    message: /tiene un nombre o una ruta que no podemos aceptar/,
  },
  { name: "sin index.html", zip: () => makeZip({ "game.js": "x" }), message: /Falta el archivo index\.html/ },
  { name: "un ejecutable disfrazado", zip: () => makeZip({ "index.html": HTML, "music.ogg": ELF }), message: /No aceptamos programas ejecutables/ },
  { name: "un archivo de un tipo no permitido", zip: () => makeZip({ "index.html": HTML, "server.php": "<?php" }), message: /No aceptamos archivos de tipo/ },
  { name: "algo que no es un zip", zip: () => Buffer.from("esto no es un zip, solo texto"), message: /no es un \.zip válido/ },
];

test("el worker rechaza con un motivo claro los zips que rompen las reglas, y el mismo borrador acepta después el bueno", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(page, { email: `e2e_worker_${suffix}@tradfal.test`, username: `worker_${lettersOnly(suffix)}`, displayName: "Persona Worker" });

  for (const rejected of REJECTED_ZIPS.slice(0, 4)) {
    await submitGameZip(page, uniqueTitle(`Rechazado: ${rejected.name}`), rejected.zip());
    await expect(page.getByText(/Tu \.zip no pasó la revisión\./)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(rejected.message)).toBeVisible();
    await expect(page).toHaveURL(/\/games\/new$/);
    await expect(page.getByRole("button", { name: "Subir otro .zip" })).toBeEnabled();
    await expect(page.getByLabel("Título")).toBeDisabled();
  }

  await page.getByLabel("Archivo .zip del juego").setInputFiles({ name: "bueno.zip", mimeType: "application/zip", buffer: validGameZip() });
  await page.getByRole("button", { name: "Subir otro .zip" }).click();
  await expect(page).toHaveURL(GAME_PAGE_URL, { timeout: 90_000 });
  await expect(page.getByRole("dialog", { name: "¡Tu juego está listo!" })).toBeVisible();
});

test("algo que no es un zip se rechaza también", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(page, { email: `e2e_notzip_${suffix}@tradfal.test`, username: `notzip_${lettersOnly(suffix)}`, displayName: "Persona Texto" });
  const rejected = REJECTED_ZIPS[4]!;
  await submitGameZip(page, uniqueTitle("Texto con nombre de zip"), rejected.zip());
  await expect(page.getByText(/Tu \.zip no pasó la revisión\./)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(rejected.message)).toBeVisible();
});
