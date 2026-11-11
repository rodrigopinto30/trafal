import { expect, test } from "@playwright/test";
import { gotoReady } from "./helpers/session";

/** «Sorprendeme»: a link that sends the person to a random published game, never to the one they are on. */
test.describe("sorprendeme", () => {
  test("está en la portada, en la búsqueda y en la página de un juego, y es un enlace común (sin precarga)", async ({ page }) => {
    await gotoReady(page, "/");
    await expect(page.getByRole("link", { name: "Sorprendeme" })).toHaveAttribute("href", "/api/surprise?lang=es");

    await gotoReady(page, "/?genre=arcade");
    await expect(page.getByRole("link", { name: "Sorprendeme" })).toHaveAttribute("href", "/api/surprise?lang=es");

    await gotoReady(page, "/games/orbita");
    await expect(page.getByRole("link", { name: "Sorprendeme" })).toHaveAttribute("href", "/api/surprise?lang=es&exclude=orbita");

    await gotoReady(page, "/en");
    await expect(page.getByRole("link", { name: "Surprise me" })).toHaveAttribute("href", "/api/surprise?lang=en");
  });

  test("lleva a la página de un juego publicado", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByRole("link", { name: "Sorprendeme" }).click();
    await expect(page).toHaveURL(/\/games\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("desde la página de un juego nunca vuelve al mismo, y el azar llega a varios juegos distintos", async ({ page, request }) => {
    const reached = new Set<string>();
    for (let attempt = 0; attempt < 24; attempt++) {
      const response = await request.get("/api/surprise?lang=es&exclude=orbita", { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const location = response.headers().location ?? "";
      expect(location).toMatch(/^http:\/\/localhost:3000\/games\/[a-z0-9-]+$/);
      expect(location).not.toBe("http://localhost:3000/games/orbita");
      expect(response.headers()["cache-control"]).toContain("no-store");
      reached.add(location);
    }
    expect(reached.size).toBeGreaterThan(3);

    await gotoReady(page, "/games/orbita");
    await page.getByRole("link", { name: "Sorprendeme" }).click();
    await expect(page).not.toHaveURL(/\/games\/orbita$/);
    await expect(page).toHaveURL(/\/games\/[a-z0-9-]+$/);
  });

  test("respeta el idioma y no se deja engañar por valores raros", async ({ request }) => {
    const english = await request.get("/api/surprise?lang=en", { maxRedirects: 0 });
    expect(english.headers().location).toMatch(/^http:\/\/localhost:3000\/en\/games\//);

    for (const query of ["lang=fr&exclude=%3Cscript%3E", "lang=en&exclude=..%2F..%2Fetc%2Fpasswd", "exclude=%27%3B%20drop%20table%20games%3B%20--", "", `lang=es&exclude=${"a".repeat(300)}`]) {
      const response = await request.get(`/api/surprise?${query}`, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toMatch(/^http:\/\/localhost:3000\/(en\/)?games\/[a-z0-9-]+$/);
    }
  });

  test("solo responde a GET", async ({ request }) => {
    const post = await request.post("/api/surprise?lang=es", { maxRedirects: 0 });
    expect(post.status()).toBe(405);
  });
});
