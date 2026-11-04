import { expect, test } from "@playwright/test";
import { gotoReady, loginWith, logout } from "./helpers/session";

test.describe("acceso", () => {
  test("contraseña incorrecta muestra un error claro", async ({ page }) => {
    await loginWith(page, "valen@trafal.test", "esto-no-es-la-clave1");
    await expect(page.getByRole("alert").filter({ hasText: "El email o la contraseña no coinciden." })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("las rutas protegidas mandan a iniciar sesión y vuelven después", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fprofile/);

    await page.getByLabel("Email").fill("valen@trafal.test");
    await page.getByLabel("Contraseña", { exact: true }).fill("trafal123");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(page.getByRole("heading", { level: 1, name: "Configuración" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Editar perfil" })).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue("Valentina Ruiz");
    await logout(page);
  });

  test("una cuenta con sesión no ve el login: la manda al inicio", async ({ page }) => {
    await loginWith(page, "mateo@trafal.test", "trafal123");
    await expect(page).toHaveURL(/localhost:3000\/?$/);
    await page.goto("/login");
    await expect(page).toHaveURL(/localhost:3000\/?$/);
    await logout(page);
  });

  test("no se puede usar un destino externo en ?next (redirección abierta)", async ({ page }) => {
    await gotoReady(page, "/login?next=https%3A%2F%2Fevil.example%2Fphishing");
    await page.getByLabel("Email").fill("valen@trafal.test");
    await page.getByLabel("Contraseña", { exact: true }).fill("trafal123");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/localhost:3000\/?$/);
    await logout(page);
  });

  test("recuperar contraseña: no revela si el email existe", async ({ page }) => {
    await gotoReady(page, "/forgot-password");
    await page.getByLabel("Email").fill("nadie-existe@trafal.test");
    await page.getByRole("button", { name: "Mandame el link" }).click();
    await expect(page.getByRole("heading", { name: "Listo, revisá tu email" })).toBeVisible();
  });
});
