import { expect, test } from "@playwright/test";
import { gotoReady, loginAndWait } from "./helpers/session";

test.describe("página del juego", () => {
  test("cuenta de qué se trata y cómo se juega, y muestra avances y comentarios", async ({ page }) => {
    await gotoReady(page, "/games/orbita");
    await expect(page).toHaveTitle(/Órbita/);
    await expect(page.getByRole("heading", { level: 1, name: "Órbita" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Sobre este juego" })).toBeVisible();
    await expect(page.getByText("Lanzá planetas y jugá con la gravedad")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Cómo se juega" })).toBeVisible();
    await expect(page.getByText("Arrastrá desde el planeta para apuntar")).toBeVisible();
    await expect(page.getByText("Probando un planeta con anillos")).toBeVisible();
    await expect(page.getByText("Me encantó usar la gravedad de las estrellas")).toBeVisible();
    await expect(page.getByText("Me gustó").first()).toBeVisible();
  });

  test("el botón de jugar está activo y apunta al dominio aislado de los juegos (los de ejemplo no tienen archivos)", async ({ page }) => {
    await gotoReady(page, "/games/orbita");
    await expect(page.getByText("Este juego puede tener sonido.")).toBeVisible();
    await page.getByRole("button", { name: "Jugar gratis" }).click();
    const frame = page.locator('iframe[title="Juego: Órbita"]');
    await expect(frame).toHaveAttribute("src", "http://orbita.games.localhost:4000/");
    await expect(page.frameLocator('iframe[title="Juego: Órbita"]').locator("body")).toContainText("Not found");
  });

  test("las respuestas de los creadores aparecen bajo cada comentario", async ({ page }) => {
    await gotoReady(page, "/games/luciernaga-valiente");
    const thread = page.getByRole("listitem").filter({ hasText: "¿Podrías sumar un modo de práctica" });
    await expect(thread).toContainText("Lo anoto para la próxima versión");
    await expect(thread).toContainText("Valentina Ruiz");
  });

  test("quien no tiene cuenta recibe la invitación a sumarse; quien la tiene, no", async ({ page }) => {
    await gotoReady(page, "/games/orbita");
    const invitation = page.getByRole("complementary").filter({ hasText: "Sumate a la comunidad" });
    await expect(invitation).toContainText("seguir a Sofi Pixels");
    await expect(invitation.getByRole("link", { name: "Crear mi cuenta" })).toHaveAttribute("href", "/signup");

    await loginAndWait(page, "valen@trafal.test", "trafal123");
    await gotoReady(page, "/games/orbita");
    await expect(page.getByRole("heading", { level: 1, name: "Órbita" })).toBeVisible();
    await expect(page.getByText("Sumate a la comunidad")).toHaveCount(0);
  });

  test("el nombre del creador lleva a su perfil", async ({ page }) => {
    await gotoReady(page, "/games/orbita");
    await page.getByRole("link", { name: "Ver perfil" }).click();
    await expect(page).toHaveURL(/\/u\/sofi_pixels$/);
  });

  test("en inglés las etiquetas se traducen", async ({ page }) => {
    await gotoReady(page, "/en/games/orbita");
    await expect(page.getByRole("heading", { level: 2, name: "How to play" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Comments" })).toBeVisible();
  });

  test.describe("juegos que no existen", () => {
    for (const path of ["/games/no-existe-este-juego", "/games/Mal_Id!"]) {
      test(`${path} muestra «No encontramos esa página»`, async ({ page }) => {
        await gotoReady(page, path);
        await expect(page.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
      });
    }
  });
});

test.describe("perfil del creador", () => {
  test("lista sus juegos y sus avances", async ({ page }) => {
    await gotoReady(page, "/u/mateo_g");
    const games = page.getByRole("tabpanel").getByRole("article");
    await expect(games).toHaveCount(3);
    await expect(page.getByRole("tabpanel")).toContainText("Neón Express");
    await expect(page.getByRole("tabpanel")).toContainText("Chancleta Run");
    await expect(page.getByRole("tabpanel")).toContainText("Colectivo 152");

    await page.getByRole("tab", { name: "Avances" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Nuevo jefe final con patrón de balas");
  });

  test("quien todavía no publicó nada ve el aviso", async ({ page }) => {
    await gotoReady(page, "/u/equipo_trafal");
    await expect(page.getByText("Todavía no subió ningún juego.")).toBeVisible();
  });
});
