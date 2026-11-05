import { expect, test } from "@playwright/test";
import { uploadGameZip } from "./helpers/game";
import { lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { makeZip, validGameZip } from "./helpers/zip";

/**
 * The worker takes each uploaded zip from the queue, validates it and either publishes its files (version «Lista») or rejects
 * it with an error the owner can understand. These tests go through the real pipeline: form → quarantine → worker → status page.
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

test("el worker rechaza con un motivo claro los zips que rompen las reglas, y acepta el bueno", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(page, { email: `e2e_worker_${suffix}@trafal.test`, username: `worker_${lettersOnly(suffix)}`, displayName: "Persona Worker" });

  for (const rejected of REJECTED_ZIPS.slice(0, 4)) {
    await uploadGameZip(page, `Rechazado: ${rejected.name}`, rejected.zip());
    await expect(page.getByText("Con errores", { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(rejected.message)).toBeVisible();
    await expect(page.getByText("No pudimos aceptar este archivo:")).toBeVisible();
  }

  await uploadGameZip(page, "El bueno", validGameZip());
  await expect(page.getByText("Lista", { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Tu juego pasó la revisión y sigue siendo un borrador")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar juego" })).toBeVisible();
});

test("algo que no es un zip se rechaza también", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(page, { email: `e2e_notzip_${suffix}@trafal.test`, username: `notzip_${lettersOnly(suffix)}`, displayName: "Persona Texto" });
  const rejected = REJECTED_ZIPS[4]!;
  await uploadGameZip(page, "Texto con nombre de zip", rejected.zip());
  await expect(page.getByText("Con errores", { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(rejected.message)).toBeVisible();
});
