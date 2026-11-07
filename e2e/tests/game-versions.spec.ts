import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { uploadGameZip } from "./helpers/game";
import { lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";
import { playableGameZip } from "./helpers/zip";

/**
 * Versions of a game: upload a new one from the owner's page, edit its name and changelog, choose which one people play and see
 * them listed on the public page. The gateway proves which version is being served. One account and one game for the whole file.
 */
test.describe.configure({ mode: "serial" });

const GATEWAY = "http://127.0.0.1:4000";

let ownerContext: BrowserContext;
let owner: Page;
let publicId = "";

/** The new-version form. The page of the previous step (the upload form) can still be mounted but hidden, so labels are searched inside this section. */
function newVersionSection(page: Page) {
  return page.getByRole("region", { name: "Subir una versión nueva" });
}

async function servedScript(request: import("@playwright/test").APIRequestContext): Promise<string> {
  const response = await request.get(`${GATEWAY}/game.js`, { headers: { host: `${publicId}.games.localhost:4000`, "sec-fetch-dest": "script" } });
  return response.text();
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  ownerContext = await browser.newContext({ ...testInfo.project.use });
  owner = await ownerContext.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  await registerAccount(owner, { email: `e2e_versions_${suffix}@trafal.test`, username: `versions_${lettersOnly(suffix)}`, displayName: "Persona Versiones" });
  await uploadGameZip(owner, "Moon Runner", playableGameZip());
  await expect(owner.getByText("Lista", { exact: true })).toBeVisible({ timeout: 45_000 });
  await owner.getByRole("button", { name: "Publicar juego" }).click();
  await expect(owner.getByText("Tu juego está publicado")).toBeVisible();
  publicId = /\/games\/([a-z0-9]+)\/manage$/.exec(owner.url())?.[1] ?? "";
  expect(publicId).not.toBe("");
});

test.afterAll(async () => {
  await ownerContext?.close();
});

test("se sube una versión nueva: queda en revisión y la gente sigue jugando la actual", async ({ request }) => {
  await expect(owner.getByText("En uso", { exact: true })).toHaveCount(1);
  await newVersionSection(owner).getByLabel("Nombre de la versión (opcional)").fill("v0.2 beta");
  await newVersionSection(owner).getByLabel("Qué cambió (opcional)").fill("Nivel nuevo\nY arreglos de salto");
  await newVersionSection(owner).getByLabel("Archivo .zip del juego").setInputFiles({ name: "v2.zip", mimeType: "application/zip", buffer: playableGameZip(" v2") });
  await newVersionSection(owner).getByRole("button", { name: "Subir versión" }).click();
  await expect(owner.getByText("¡Listo! La versión quedó en revisión.")).toBeVisible({ timeout: 30_000 });

  await expect(owner.getByRole("heading", { level: 3, name: "Versión v0.2 beta" })).toBeVisible();
  await expect(owner.getByText("Lista", { exact: true })).toHaveCount(2, { timeout: 45_000 });
  await expect(owner.getByText("Nivel nuevo")).toBeVisible();
  await expect(newVersionSection(owner).getByLabel("Nombre de la versión (opcional)")).toHaveValue("");

  await expect(owner.getByText("En uso", { exact: true })).toHaveCount(1);
  expect(await servedScript(request)).toContain('"corriendo"');
});

test("se elige qué versión juega la gente, y se puede volver a la anterior", async ({ request }) => {
  const second = owner.getByRole("listitem").filter({ hasText: "Versión v0.2 beta" });
  await second.getByRole("button", { name: "Usar esta versión" }).click();
  await expect(second.getByText("En uso", { exact: true })).toBeVisible();
  await expect(second.getByRole("button", { name: "Usar esta versión" })).toHaveCount(0);
  await expect.poll(() => servedScript(request), { timeout: 20_000, intervals: [1000] }).toContain("corriendo v2");

  const first = owner.getByRole("listitem").filter({ hasText: "Versión v1" });
  await first.getByRole("button", { name: "Usar esta versión" }).click();
  await expect(first.getByText("En uso", { exact: true })).toBeVisible();
  await expect.poll(() => servedScript(request), { timeout: 20_000, intervals: [1000] }).not.toContain("corriendo v2");

  await second.getByRole("button", { name: "Usar esta versión" }).click();
  await expect(second.getByText("En uso", { exact: true })).toBeVisible();
});

test("se edita el nombre y lo que cambió, con validación", async () => {
  await owner.getByRole("button", { name: "Editar la versión v0.2 beta" }).click();
  const dialog = owner.getByRole("dialog", { name: "Editar la versión" });
  await expect(dialog.getByLabel("Nombre")).toHaveValue("v0.2 beta");
  await dialog.getByLabel("Nombre").fill("   ");
  await expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
  await dialog.getByLabel("Nombre").fill("v0.2 final");
  await dialog.getByLabel("Qué cambió (opcional)").fill("Nivel nuevo, arreglos de salto y música");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toBeHidden();
  await expect(owner.getByRole("heading", { level: 3, name: "Versión v0.2 final" })).toBeVisible();
  await expect(owner.getByText("Nivel nuevo, arreglos de salto y música")).toBeVisible();
});

test("la página pública lista las versiones listas, con la actual marcada y sus cambios", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}`);
  const section = visitor.getByRole("region", { name: "Versiones" });
  await expect(section.getByRole("heading", { level: 3 })).toHaveText(["v0.2 final", "v1"]);
  await expect(section.getByText("Versión actual")).toHaveCount(1);
  await expect(section.getByRole("listitem").filter({ hasText: "v0.2 final" })).toContainText("Versión actual");
  await expect(section.getByText("Nivel nuevo, arreglos de salto y música")).toBeVisible();
  await expect(section.getByText("Sin detalles de esta versión.")).toBeVisible();
  await context.close();
});

test("quien no es dueño no ve los controles, y un archivo que no es .zip se avisa antes de enviarlo", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use });
  const visitor = await context.newPage();
  await visitor.goto(`/games/${publicId}/manage`);
  await expect(visitor).toHaveURL(/\/login/);
  await context.close();

  await newVersionSection(owner).getByLabel("Archivo .zip del juego").setInputFiles({ name: "juego.rar", mimeType: "application/x-rar", buffer: Buffer.from("x") });
  await newVersionSection(owner).getByRole("button", { name: "Subir versión" }).click();
  await expect(owner.getByText("El archivo tiene que ser un .zip.")).toBeVisible();
});
