import { expect, test, type Page } from "@playwright/test";
import { makePng, replaceFilePart } from "./helpers/images";
import { gotoReady, lettersOnly, loginAndWait, registerAccount, uniqueSuffix } from "./helpers/session";
import { publicProfile } from "./helpers/supabase";

/**
 * La foto de perfil. El navegador la recorta y la achica, pero el SERVIDOR no se fía: estas pruebas le mandan a la Server
 * Action archivos que el formulario real jamás generaría (se cambia el contenido de la petición en vuelo) y comprueban que los
 * rechaza con un mensaje claro y SIN guardar nada ni en el almacenamiento ni en el perfil.
 */

const PHOTO_URL = "img[src*='/storage/v1/object/public/media/avatars/']";

type Tamper = { bytes: Buffer; mime: string } | null;

/** Intercepta las llamadas a Server Actions con archivos y, si `tamper` está puesto, cambia el archivo que viaja. */
async function installTamper(page: Page): Promise<{ set: (value: Tamper) => void }> {
  let tamper: Tamper = null;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const headers = request.headers();
    const body = request.postDataBuffer();
    if (tamper && request.method() === "POST" && headers["next-action"] && body && (headers["content-type"] ?? "").startsWith("multipart/form-data")) {
      return route.continue({ postData: replaceFilePart(body, headers["content-type"] as string, tamper.bytes, tamper.mime) });
    }
    return route.continue();
  });
  return { set: (value) => void (tamper = value) };
}

/** Abre el editor con una foto válida (para tener un envío real) y devuelve el diálogo. */
async function openEditor(page: Page) {
  await page.getByTestId("avatar-file").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: makePng(300, 300) });
  const dialog = page.getByRole("dialog", { name: "Ajustá tu foto" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("foto de perfil: se sube, se reemplaza y se quita; el servidor rechaza archivos manipulados", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const username = `e2e_${lettersOnly(suffix)}`;
  await registerAccount(page, { email: `e2e_${suffix}@trafal.test`, username, displayName: "Foto de Prueba" });
  await gotoReady(page, "/settings/profile");
  const tamper = await installTamper(page);

  // Cada caso: qué se manda en lugar de la foto real → qué mensaje tiene que ver la persona.
  const rejected: { name: string; bytes: Buffer; mime: string; message: string }[] = [
    { name: "HTML disfrazado de WebP", bytes: Buffer.from("<!doctype html><script>alert(1)</script>"), mime: "image/webp", message: "Ese formato no se admite" },
    { name: "SVG (puede traer scripts)", bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), mime: "image/svg+xml", message: "Ese formato no se admite" },
    { name: "PNG que dice ser WebP", bytes: makePng(256, 256), mime: "image/webp", message: "Ese formato no se admite" },
    { name: "PNG con datos pegados al final", bytes: Buffer.concat([makePng(256, 256), Buffer.from("<script>alert(1)</script>")]), mime: "image/png", message: "Ese formato no se admite" },
    { name: "PNG de otro tamaño", bytes: makePng(512, 512), mime: "image/png", message: "La foto no tiene el tamaño esperado" },
    { name: "PNG gigante en píxeles", bytes: makePng(1024, 1024), mime: "image/png", message: "La foto no tiene el tamaño esperado" },
    { name: "PNG animado", bytes: makePng(256, 256, { animated: true }), mime: "image/png", message: "No se admiten imágenes animadas" },
    { name: "archivo demasiado pesado", bytes: Buffer.alloc(300 * 1024), mime: "image/webp", message: "La foto quedó demasiado pesada" },
  ];

  for (const item of rejected) {
    const dialog = await openEditor(page);
    tamper.set({ bytes: item.bytes, mime: item.mime });
    await dialog.getByRole("button", { name: "Guardar foto" }).click();
    await expect(dialog.getByRole("alert"), item.name).toContainText(item.message);
    await expect(dialog, `${item.name}: el diálogo sigue abierto`).toBeVisible();
    tamper.set(null);
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  }

  // Nada de lo rechazado quedó guardado: el perfil sigue sin foto.
  expect((await publicProfile(username)).avatar_path).toBeNull();
  await expect(page.locator(PHOTO_URL)).toHaveCount(0);

  // Un PNG de 256×256 bien formado SÍ se acepta (y se guarda con su formato real).
  let dialog = await openEditor(page);
  tamper.set({ bytes: makePng(256, 256), mime: "image/png" });
  await dialog.getByRole("button", { name: "Guardar foto" }).click();
  await expect(page.getByText("¡Foto actualizada!")).toBeVisible();
  tamper.set(null);
  const first = page.locator(PHOTO_URL).first();
  await expect(first).toBeVisible();
  const firstUrl = (await first.getAttribute("src")) ?? "";
  expect(firstUrl).toMatch(/\/avatars\/[0-9a-f-]{36}\/[0-9a-f]{32}\.png$/);
  expect((await page.request.get(firstUrl)).headers()["content-type"]).toBe("image/png");
  expect(String((await publicProfile(username)).avatar_path)).toMatch(/^avatars\/[0-9a-f-]{36}\/[0-9a-f]{32}\.png$/);

  // Reemplazarla por otra (la real, recortada por el navegador a WebP): la anterior se borra del almacenamiento.
  dialog = await openEditor(page);
  await dialog.getByRole("button", { name: "Guardar foto" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => ((await page.locator(PHOTO_URL).first().getAttribute("src")) ?? "") !== firstUrl).toBe(true);
  const secondUrl = (await page.locator(PHOTO_URL).first().getAttribute("src")) ?? "";
  expect(secondUrl).toMatch(/\.webp$/);
  expect((await page.request.get(secondUrl)).status()).toBe(200);
  expect((await page.request.get(firstUrl)).status(), "la foto vieja ya no debería existir").not.toBe(200);

  // Quitarla: vuelve la letra de colores y el archivo se borra.
  await page.getByRole("button", { name: "Quitar foto" }).click();
  await expect(page.getByText("Quitamos tu foto.")).toBeVisible();
  await expect(page.locator(PHOTO_URL)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Quitar foto" })).toHaveCount(0);
  expect((await publicProfile(username)).avatar_path).toBeNull();
  expect((await page.request.get(secondUrl)).status()).not.toBe(200);
});

test("foto de perfil: archivos que no son imágenes o son demasiado grandes se avisan sin mandarlos al servidor", async ({ page }) => {
  await loginAndWait(page, "mateo@trafal.test", "trafal123");
  await gotoReady(page, "/settings/profile");

  let uploads = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) uploads++;
  });

  const input = page.getByTestId("avatar-file");
  await input.setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("esto no es una imagen") });
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos leer esa imagen" })).toBeVisible();

  await input.setInputFiles({ name: "enorme.png", mimeType: "image/png", buffer: Buffer.alloc(16 * 1024 * 1024) });
  await expect(page.getByRole("alert").filter({ hasText: "Esa imagen es muy pesada" })).toBeVisible();

  expect(uploads, "no se manda nada al servidor").toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
