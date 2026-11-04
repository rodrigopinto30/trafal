import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { makePng } from "./helpers/images";
import { confirmationLink, waitForEmailHtml } from "./helpers/mailpit";
import { gotoReady, lettersOnly, logout, uniqueSuffix } from "./helpers/session";

mkdirSync("screenshots", { recursive: true });

test("una persona nueva se registra, completa su perfil, lo edita y sigue a otra", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const suffix = uniqueSuffix(testInfo.project.name);
  const email = `e2e_${suffix}@trafal.test`;
  // Sin un solo número a propósito: si el nombre está libre, se puede usar tal cual.
  const username = `sin_numeros_${lettersOnly(suffix)}`;
  expect(username).not.toMatch(/\d/);
  const password = "Trafal12345";

  /* ---------- 1) Registro: pide 18+ y términos (casilla) y repetir la contraseña ---------- */
  await gotoReady(page, "/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetí la contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Para crear tu cuenta tenés que confirmar que tenés 18 años o más")).toBeVisible();

  // Tras el error no se pierde lo que ya escribió (React 19 vacía los campos no controlados al terminar la acción).
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue(password);
  await expect(page.getByLabel("Repetí la contraseña")).toHaveValue(password);

  // Con la casilla tildada pero las contraseñas distintas: el error es claro y la casilla SIGUE tildada.
  const adult = page.getByRole("checkbox", { name: /18 años o más/ });
  await adult.check();
  await page.getByLabel("Repetí la contraseña").fill("Trafal12346");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
  await expect(adult).toBeChecked();
  await expect(page.getByLabel("Repetí la contraseña")).toHaveValue("Trafal12346");

  await page.getByLabel("Repetí la contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Revisá tu email" })).toBeVisible();

  /* ---------- 2) Confirmación por mail (llega al buzón de pruebas Mailpit) ---------- */
  const html = await waitForEmailHtml(email);
  await page.goto(confirmationLink(html));
  await page.waitForLoadState("networkidle");

  /* ---------- 3) Onboarding: el @usuario se valida en vivo y no exige números ---------- */
  await expect(page).toHaveURL(/\/onboarding/);
  const usernameField = page.getByLabel("Tu @usuario");
  await usernameField.fill("admin");
  await expect(page.getByText("Ese @usuario no está disponible.")).toBeVisible();
  await usernameField.fill("con espacio");
  await expect(page.getByText("Usá solo letras, números, punto (.) y guion bajo (_), sin espacios.")).toBeVisible();
  await usernameField.fill("ab");
  await expect(page.getByText("Muy corto: usá al menos 3 caracteres.")).toBeVisible();
  await usernameField.fill("hola.");
  await expect(page.getByText("El punto no puede ir al principio, al final ni repetido.")).toBeVisible();

  // Ocupado: avisa y sugiere alternativas LIBRES y sin números. Elegir una la completa sola.
  await usernameField.fill("valen_makes");
  await expect(page.getByText("Ese @usuario ya lo usa alguien más.")).toBeVisible();
  const suggestion = page.getByRole("button", { name: /^Usar @valen_makes/ }).first();
  await expect(suggestion).toBeVisible();
  const suggestedName = (await suggestion.innerText()).replace("@", "");
  expect(suggestedName).not.toMatch(/\d/);
  await suggestion.click();
  await expect(usernameField).toHaveValue(suggestedName);
  await expect(page.getByText("¡Está libre!")).toBeVisible();

  // Con mayúsculas y acentos: se normaliza sola («Ñandú_Dev» → «nandu_dev») y, si está libre, se puede usar.
  await usernameField.fill("Ñandú_Dev_E2E");
  await expect(page.getByText("¡Está libre! Se guarda como @nandu_dev_e2e.")).toBeVisible();

  await usernameField.fill(username);
  await expect(page.getByText("¡Está libre!")).toBeVisible();
  // Se registró con la casilla marcada: el onboarding no la vuelve a pedir.
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByLabel("Tu nombre").fill("Persona de Prueba");
  await page.screenshot({ path: `screenshots/${testInfo.project.name}-flujo-onboarding.png`, fullPage: true });
  await page.getByRole("button", { name: "Entrar a Trafal" }).click();

  /* ---------- 4) Su perfil: todavía sin foto ni géneros → la invita a terminarlo ---------- */
  await expect(page).toHaveURL(new RegExp(`/u/${username}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Persona de Prueba" })).toBeVisible();
  await expect(page.locator("#contenido").getByRole("link", { name: "Editar perfil" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terminá tu perfil" })).toBeVisible();
  // La barra ya muestra el menú de la cuenta (no quedó en el estado «sin perfil»).
  await expect(page.getByRole("banner").getByRole("link", { name: "Completar perfil" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Seguir a/ })).toHaveCount(0); // no se sigue a sí misma

  /* ---------- 5) Configuración → Perfil: datos, motores, géneros favoritos y foto ---------- */
  await page.getByRole("link", { name: "Editar perfil" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Configuración" })).toBeVisible();

  await page.getByLabel("Bio").fill("Hago juegos de prueba. 🎮");
  await page.getByLabel("Ciudad").fill("Rosario");
  await page.getByLabel("País").selectOption("AR");
  await page.getByText("Godot", { exact: true }).click();
  await page.getByText("Phaser", { exact: true }).click();
  await expect(page.getByLabel("Godot")).toBeChecked();

  // La grilla de géneros: tocar uno lo elige, tocarlo de nuevo lo saca.
  await expect(page.getByText("Todavía no elegiste ninguno.")).toBeVisible();
  const platformer = page.getByRole("checkbox", { name: "Plataformas" });
  await page.getByText("Plataformas", { exact: true }).click();
  await expect(platformer).toBeChecked();
  await expect(page.getByText("Elegiste 1 género.")).toBeVisible();
  await page.getByText("Plataformas", { exact: true }).click();
  await expect(platformer).not.toBeChecked();
  await expect(page.getByText("Todavía no elegiste ninguno.")).toBeVisible();
  await page.getByText("Arcade", { exact: true }).click();
  await page.getByText("Disparos", { exact: true }).click();
  await expect(page.getByText("Elegiste 2 géneros.")).toBeVisible();

  // La foto de perfil: se elige un archivo, se ajusta el recorte y se guarda.
  await page.getByTestId("avatar-file").setInputFiles({ name: "mi-foto.png", mimeType: "image/png", buffer: makePng(600, 400) });
  const editor = page.getByRole("dialog", { name: "Ajustá tu foto" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Zoom").fill("2");
  const crop = editor.getByRole("group", { name: /Recorte de la foto/ });
  const box = await crop.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  await page.mouse.down();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2 + 30, (box?.y ?? 0) + (box?.height ?? 0) / 2 + 10, { steps: 4 });
  await page.mouse.up();
  await crop.focus();
  await page.keyboard.press("ArrowLeft");
  await page.screenshot({ path: `screenshots/${testInfo.project.name}-flujo-recorte-foto.png` });
  await editor.getByRole("button", { name: "Guardar foto" }).click();
  await expect(page.getByText("¡Foto actualizada!")).toBeVisible();
  await expect(editor).toBeHidden();

  // La foto quedó en el almacenamiento: es un WebP de 256 px, público y con caché inmutable.
  const photo = page.locator("img[src*='/storage/v1/object/public/media/avatars/']").first();
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(256);
  const photoUrl = (await photo.getAttribute("src")) ?? "";
  const photoResponse = await page.request.get(photoUrl);
  expect(photoResponse.status()).toBe(200);
  expect(photoResponse.headers()["content-type"]).toBe("image/webp");
  expect(photoResponse.headers()["cache-control"]).toContain("immutable");

  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("¡Cambios guardados!")).toBeVisible();
  await page.screenshot({ path: `screenshots/${testInfo.project.name}-flujo-editar-perfil.png`, fullPage: true });

  /* ---------- 6) El perfil público muestra todo; ya no la invita a terminarlo ---------- */
  await page.goto(`/u/${username}`);
  await expect(page.getByText("Hago juegos de prueba. 🎮")).toBeVisible();
  await expect(page.getByText("Rosario, Argentina")).toBeVisible();
  await expect(page.getByText("Godot", { exact: true })).toBeVisible();
  await expect(page.getByText("Phaser", { exact: true })).toBeVisible();
  const genres = page.getByRole("list").filter({ hasText: "Arcade" }).first();
  await expect(genres).toContainText("Disparos");
  await expect(page.getByText("Plataformas", { exact: true })).toHaveCount(0);
  await expect(page.locator("img[src*='/storage/v1/object/public/media/avatars/']").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terminá tu perfil" })).toHaveCount(0);

  // Se quita la foto (cubre el flujo completo y no deja archivos de prueba en el almacenamiento).
  await gotoReady(page, "/settings/profile");
  await page.getByRole("button", { name: "Quitar foto" }).click();
  await expect(page.getByText("Quitamos tu foto.")).toBeVisible();
  await expect(page.locator("img[src*='/storage/v1/object/public/media/avatars/']")).toHaveCount(0);
  expect((await page.request.get(photoUrl)).status(), "la foto quitada ya no existe en el almacenamiento").not.toBe(200);

  /* ---------- 7) Seguir y dejar de seguir a otra persona ---------- */
  await page.goto("/u/mateo_g");
  const followers = page.getByRole("link", { name: /seguidor/ });
  const before = Number((await followers.innerText()).match(/\d+/)?.[0]);
  await page.getByRole("button", { name: "Seguir a @mateo_g" }).click();
  await expect(page.getByRole("button", { name: "Dejar de seguir a @mateo_g" })).toBeVisible();
  await expect(followers).toContainText(String(before + 1));

  await page.reload(); // el estado persiste en la base de datos, no solo en pantalla
  await expect(page.getByRole("button", { name: "Dejar de seguir a @mateo_g" })).toBeVisible();

  await page.goto(`/u/${username}/following`);
  await expect(page.getByRole("link", { name: /Mateo G\./ })).toBeVisible();

  await page.goto("/u/mateo_g");
  await page.getByRole("button", { name: "Dejar de seguir a @mateo_g" }).click();
  await expect(page.getByRole("button", { name: "Seguir a @mateo_g" })).toBeVisible();
  await expect(followers).toContainText(String(before));

  /* ---------- 8) El menú de la cuenta (para revisar el diseño) y cerrar sesión ---------- */
  await page.goto(`/u/${username}`);
  const account = page.getByRole("button", { name: "Tu cuenta" });
  const burger = page.getByRole("button", { name: "Abrir menú" });
  await expect(account.or(burger).first()).toBeVisible();
  await (testInfo.project.name === "desktop" ? account : burger).click();
  await expect(page.getByRole("menuitem", { name: "Configuración" }).or(page.getByRole("link", { name: "Configuración" }))).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `screenshots/${testInfo.project.name}-flujo-menu-abierto.png` });
  await page.keyboard.press("Escape");
  await logout(page);
});
