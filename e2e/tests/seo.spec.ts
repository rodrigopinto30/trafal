import { expect, test, type APIRequestContext } from "@playwright/test";
import { gotoReady, lettersOnly, registerAccount, uniqueSuffix } from "./helpers/session";

/**
 * What search engines and social networks see: the head of each kind of page (title, description, canonical address, languages,
 * Open Graph and Twitter cards, whether it may be listed), the structured data, robots.txt, the sitemap and the share pictures.
 * Pages are fetched as a crawler would (the metadata arrives in the head for them).
 */
const CRAWLER = { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" };
const SITE = "http://localhost:3000";

async function fetchHtml(request: APIRequestContext, path: string): Promise<string> {
  const response = await request.get(path, { headers: CRAWLER });
  expect(response.status()).toBe(200);
  return response.text();
}

function decode(value: string): string {
  return value.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

function meta(html: string, attribute: "name" | "property", key: string): string | null {
  const match = new RegExp(`<meta ${attribute}="${key}" content="([^"]*)"`).exec(html);
  return match?.[1] === undefined ? null : decode(match[1]);
}

function link(html: string, rel: string, extra = ""): string | null {
  const match = new RegExp(`<link rel="${rel}"${extra} href="([^"]*)"`).exec(html);
  return match?.[1] ?? null;
}

function hreflangs(html: string): Record<string, string> {
  return Object.fromEntries([...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
}

function structuredData(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1] ?? "{}") as Record<string, unknown>);
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test.describe("metadatos de cada página", () => {
  test("la portada, en cada idioma: título, descripción, dirección canónica, idiomas, tarjetas y datos del sitio", async ({ request }) => {
    const es = await fetchHtml(request, "/");
    expect(es).toContain("<title>Trafal - Publicá tu juego. Sumá jugadores.</title>");
    expect(meta(es, "name", "description")).toContain("red social para quienes hacen videojuegos");
    expect(link(es, "canonical")).toBe(SITE);
    expect(hreflangs(es)).toEqual({ es: `${SITE}`, en: `${SITE}/en`, "x-default": `${SITE}` });
    expect(meta(es, "property", "og:title")).toBe("Trafal - Publicá tu juego. Sumá jugadores.");
    expect(meta(es, "property", "og:locale")).toBe("es_AR");
    expect(meta(es, "property", "og:image")).toMatch(/\/es\/opengraph-image\?/);
    expect(meta(es, "name", "twitter:card")).toBe("summary_large_image");
    const [site] = structuredData(es);
    expect(site).toMatchObject({ "@type": "WebSite", name: "Trafal", inLanguage: "es" });
    expect(JSON.stringify(site)).toContain("/?q={search_term_string}");

    const en = await fetchHtml(request, "/en");
    expect(en).toContain("<title>Trafal - Publish your game. Get players.</title>");
    expect(link(en, "canonical")).toBe(`${SITE}/en`);
    expect(meta(en, "property", "og:locale")).toBe("en_US");
    expect(meta(en, "property", "og:locale:alternate")).toBe("es_AR");
  });

  test("un juego: su título y descripción, el idioma alternativo, tarjeta y datos de «videojuego»", async ({ request }) => {
    const html = await fetchHtml(request, "/games/orbita");
    expect(html).toContain("<title>Trafal - Órbita</title>");
    expect(meta(html, "name", "description")).toContain("Lanzá planetas y jugá con la gravedad");
    expect(link(html, "canonical")).toBe(`${SITE}/games/orbita`);
    expect(hreflangs(html)).toMatchObject({ es: `${SITE}/games/orbita`, en: `${SITE}/en/games/orbita` });
    expect(meta(html, "property", "og:url")).toBe(`${SITE}/games/orbita`);
    expect(meta(html, "property", "og:image")).toMatch(/\/es\/games\/orbita\/opengraph-image\?/);
    expect(meta(html, "robots" as never, "x")).toBeNull();
    const [game] = structuredData(html);
    expect(game).toMatchObject({ "@type": "VideoGame", name: "Órbita", genre: "puzzle", gamePlatform: "Web browser", isAccessibleForFree: true, author: { name: "Sofi Pixels" } });

    const en = await fetchHtml(request, "/en/games/orbita");
    expect(link(en, "canonical")).toBe(`${SITE}/en/games/orbita`);
  });

  test("un perfil: nombre y @usuario en el título, la bio como descripción y datos de «persona»", async ({ request }) => {
    const html = await fetchHtml(request, "/u/sofi_pixels");
    expect(html).toContain("<title>Trafal - Sofi Pixels (@sofi_pixels)</title>");
    expect(meta(html, "name", "description")).toContain("Puzzles de física");
    expect(meta(html, "property", "og:type")).toBe("profile");
    expect(link(html, "canonical")).toBe(`${SITE}/u/sofi_pixels`);
    expect(structuredData(html)[0]).toMatchObject({ "@type": "ProfilePage", mainEntity: { "@type": "Person", name: "Sofi Pixels", alternateName: "@sofi_pixels" } });
  });

  test("una búsqueda de la portada no se indexa y apunta a la portada", async ({ request }) => {
    for (const view of ["/?q=orbita", "/?genre=arcade&sort=plays", "/?sort=recent"]) {
      const html = await fetchHtml(request, view);
      expect(meta(html, "name", "robots"), view).toBe("noindex, follow");
      expect(link(html, "canonical"), view).toBe(SITE);
    }
    const plain = await fetchHtml(request, "/");
    expect(meta(plain, "name", "robots")).toBeNull();
    expect(link(plain, "canonical")).toBe(SITE);
  });

  test("Comunidad y Creadores: la vista base se indexa; una vista filtrada no y apunta a la base", async ({ request }) => {
    for (const [base, filtered] of [["/feed", "/feed?kind=hito"], ["/creators", "/creators?engine=godot"]] as const) {
      const plain = await fetchHtml(request, base);
      expect(meta(plain, "name", "robots"), base).toBeNull();
      expect(link(plain, "canonical")).toBe(`${SITE}${base}`);

      const view = await fetchHtml(request, filtered);
      expect(meta(view, "name", "robots"), filtered).toBe("noindex, follow");
      expect(link(view, "canonical"), filtered).toBe(`${SITE}${base}`);
    }
  });

  test("el ícono de Trafal está en la pestaña (SVG) y como ícono de inicio (PNG), y los títulos son «Trafal - página»", async ({ request }) => {
    const html = await fetchHtml(request, "/feed");
    expect(html).toMatch(/<link rel="icon" href="\/icon\.svg[^"]*"/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-icon\.png[^"]*"/);
    expect(html).toContain("<title>Trafal - Comunidad</title>");
    const icon = await request.get("/icon.svg");
    expect(icon.status()).toBe(200);
    expect(icon.headers()["content-type"]).toContain("svg");
    const apple = await request.get("/apple-icon.png");
    expect(apple.status()).toBe(200);
    expect(apple.headers()["content-type"]).toContain("png");
  });

  test("las pantallas de acceso, las listas de seguidores y las páginas que no existen piden no figurar", async ({ request }) => {
    for (const path of ["/login", "/signup", "/forgot-password", "/u/sofi_pixels/followers", "/u/sofi_pixels/following"]) {
      expect(meta(await fetchHtml(request, path), "name", "robots"), path).toBe("noindex, follow");
    }
    for (const path of ["/pagina-que-no-existe", "/games/no-existe", "/u/nadie_existe_9"]) {
      const response = await request.get(path, { headers: CRAWLER });
      expect([200, 404], path).toContain(response.status());
      expect(meta(await response.text(), "name", "robots"), path).toMatch(/^noindex/);
    }
  });

  test("los documentos legales tienen su propio título y dirección", async ({ request }) => {
    const html = await fetchHtml(request, "/en/legal/privacy");
    expect(html).toContain("<title>Trafal - Privacy policy</title>");
    expect(link(html, "canonical")).toBe(`${SITE}/en/legal/privacy`);
  });
});

test.describe("robots.txt y sitemap", () => {
  test("un sitio que no es público (localhost, un dominio de prueba) se cierra por completo", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("User-Agent: *");
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toContain("Allow: /");
  });

  test("el sitemap lista las páginas fijas, los juegos publicados, los creadores y los avances, en cada idioma y con sus traducciones", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const xml = await response.text();
    expect(xml).not.toContain("/explore");
    for (const path of ["/", "/en", "/en/creators", "/feed", "/legal/terms", "/games/orbita", "/en/games/orbita", "/games/neon-express", "/u/sofi_pixels", "/en/u/valen_makes"]) {
      expect(xml, path).toContain(`<loc>${SITE}${path}</loc>`);
    }
    expect(xml).toMatch(/<loc>http:\/\/localhost:3000\/posts\/[0-9a-f-]{36}<\/loc>/);
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="en" href="${SITE}/en/games/orbita" />`);
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/games/orbita" />`);
    for (const closed of ["/settings", "/saved", "/games/new", "/posts/new", "/login", "/signup", "/manage"]) expect(xml, closed).not.toContain(closed);
  });
});

test.describe("imágenes para compartir", () => {
  for (const path of ["/opengraph-image", "/en/opengraph-image", "/games/orbita/opengraph-image", "/en/games/orbita/opengraph-image", "/u/sofi_pixels/opengraph-image", "/games/no-existe/opengraph-image", "/u/nadie_existe_9/opengraph-image"]) {
    test(`${path} es una imagen PNG de 1200 × 630`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
      const body = await response.body();
      expect(body.length).toBeGreaterThan(5_000);
      expect(body.length).toBeLessThan(500_000);
      expect(pngSize(body)).toEqual({ width: 1200, height: 630 });
    });
  }

  test("la imagen de un avance también", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const id = /\/posts\/([0-9a-f-]{36})</.exec(sitemap)?.[1];
    expect(id).toBeTruthy();
    const response = await request.get(`/posts/${id}/opengraph-image`);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect(pngSize(await response.body())).toEqual({ width: 1200, height: 630 });
  });

  test("las tarjetas de una página apuntan a su imagen y esa imagen se descarga", async ({ request }) => {
    const html = await fetchHtml(request, "/games/orbita");
    const image = meta(html, "property", "og:image") ?? "";
    expect(image).toMatch(/^http:\/\/localhost:3000\//);
    expect(meta(html, "name", "twitter:image")).toBe(image);
    const response = await request.get(image.replace(SITE, ""));
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });
});

test("lo que una persona escribe en su bio nunca cierra la etiqueta de datos estructurados", async ({ browser, request }, testInfo) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ ...testInfo.project.use });
  const page = await context.newPage();
  const suffix = uniqueSuffix(testInfo.project.name);
  const username = `seo_${lettersOnly(suffix)}`;
  await registerAccount(page, { email: `e2e_seo_${suffix}@trafal.test`, username, displayName: "Persona SEO" });

  await gotoReady(page, "/settings/profile");
  await page.getByLabel("Bio").fill('</script><script>window.pwned=1</script> & "comillas"');
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("¡Cambios guardados!")).toBeVisible();

  const html = await fetchHtml(request, `/u/${username}`);
  expect(html).not.toContain("<script>window.pwned=1</script>");
  const [profile] = structuredData(html);
  expect(JSON.stringify(profile)).toContain("window.pwned=1");
  expect(meta(html, "name", "description")).toContain("window.pwned=1");
  await context.close();
});
