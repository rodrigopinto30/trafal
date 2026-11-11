import { describe, expect, it } from "vitest";
import { buildRobots } from "./robots";
import { buildSitemap } from "./sitemap";
import { pageMetadata } from "./metadata";
import { absoluteUrl, excerpt, isPublicSite, languageAlternates } from "./site";
import { gameData, personData, postData, serializeStructuredData, webSiteData } from "./structured-data";

const SITE = "https://trafal.example";

describe("addresses", () => {
  it("builds the public address of a page in each language", () => {
    expect(absoluteUrl("es", "/games/orbita", SITE)).toBe("https://trafal.example/games/orbita");
    expect(absoluteUrl("en", "/games/orbita", SITE)).toBe("https://trafal.example/en/games/orbita");
    expect(absoluteUrl("es", "/", SITE)).toBe("https://trafal.example/");
    expect(absoluteUrl("en", "/", SITE)).toBe("https://trafal.example/en");
  });

  it("lists the same page in every language, with Spanish as the default", () => {
    expect(languageAlternates("/explore", SITE)).toEqual({
      es: "https://trafal.example/explore",
      en: "https://trafal.example/en/explore",
      "x-default": "https://trafal.example/explore",
    });
  });

  it.each([
    ["http://localhost:3000", false],
    ["http://127.0.0.1:3000", false],
    ["http://0.0.0.0:3000", false],
    ["https://staging.trafal.local", false],
    ["https://trafal.test", false],
    ["not a url", false],
    ["https://trafal.example", true],
    ["https://www.trafal.com", true],
  ])("%s is public: %s", (url, expected) => {
    expect(isPublicSite(url)).toBe(expected);
  });
});

describe("excerpt", () => {
  it("leaves a short text as it is, in one line", () => {
    expect(excerpt("  Un juego\n\nde   gravedad ", 100)).toBe("Un juego de gravedad");
  });

  it("cuts a long text at a word and adds an ellipsis, never above the limit", () => {
    const text = "Lanzá planetas y jugá con la gravedad de las estrellas para llegar a la meta antes de que se acabe el tiempo";
    const cut = excerpt(text, 50);
    expect(Array.from(cut).length).toBeLessThanOrEqual(50);
    expect(cut.endsWith("…")).toBe(true);
    expect(text.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut).not.toMatch(/\s…$/);
  });

  it("counts emoji as one character", () => {
    expect(excerpt("🎮".repeat(10), 10)).toBe("🎮".repeat(10));
  });
});

describe("pageMetadata", () => {
  it("gives a page its canonical address, its languages and its cards", () => {
    const metadata = pageMetadata({ title: "Órbita", description: "Gravedad.", path: "/games/orbita", locale: "en" });
    expect(metadata.title).toBe("Órbita");
    expect(metadata.alternates?.canonical).toBe(`${absoluteUrl("en", "/games/orbita")}`);
    expect(Object.keys(metadata.alternates?.languages ?? {})).toEqual(["es", "en", "x-default"]);
    expect(metadata.openGraph).toMatchObject({ type: "website", title: "Órbita · Trafal", locale: "en_US", alternateLocale: ["es_AR"] });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "Órbita · Trafal" });
    expect(metadata.robots).toBeUndefined();
  });

  it("can ask not to be indexed, and use a title that already says the site name", () => {
    expect(pageMetadata({ title: "Iniciar sesión", description: "x", path: "/login", locale: "es", noindex: true }).robots).toEqual({ index: false, follow: true });
    const home = pageMetadata({ title: "Trafal — Publicá tu juego", description: "x", path: "/", locale: "es", titleIsComplete: true });
    expect(home.title).toEqual({ absolute: "Trafal — Publicá tu juego" });
    expect(home.openGraph).toMatchObject({ title: "Trafal — Publicá tu juego" });
  });
});

describe("robots", () => {
  it("closes a site that is not public completely", () => {
    expect(buildRobots("http://localhost:3000")).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("opens the public site except for the private areas in each language, and points at the sitemap", () => {
    const robots = buildRobots(SITE);
    const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rules?.allow).toBe("/");
    const disallow = rules?.disallow as string[];
    for (const path of ["/api/", "/auth/", "/settings", "/saved", "/games/new", "/games/*/manage", "/en/settings", "/en/games/*/manage", "/login", "/en/login"]) {
      expect(disallow).toContain(path);
    }
    expect(disallow).not.toContain("/");
    expect(robots.sitemap).toBe("https://trafal.example/sitemap.xml");
  });
});

describe("sitemap", () => {
  const sitemap = buildSitemap(
    {
      games: [{ public_id: "orbita", updated_at: "2026-11-01T10:00:00Z" }],
      creators: [{ username: "sofi_pixels", updated_at: "2026-11-02T10:00:00Z" }],
      posts: [{ id: "55555555-5555-4555-8555-555555555510", updated_at: "2026-11-03T10:00:00Z" }],
    },
    SITE,
  );
  const urls = sitemap.map((entry) => entry.url);

  it("lists every page in each language", () => {
    expect(urls).toContain("https://trafal.example/");
    expect(urls).toContain("https://trafal.example/en");
    expect(urls).toContain("https://trafal.example/games/orbita");
    expect(urls).toContain("https://trafal.example/en/games/orbita");
    expect(urls).toContain("https://trafal.example/u/sofi_pixels");
    expect(urls).toContain("https://trafal.example/en/posts/55555555-5555-4555-8555-555555555510");
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("leaves out everything private", () => {
    expect(urls.filter((url) => /settings|saved|manage|\/new|login|signup/.test(url))).toEqual([]);
  });

  it("says where each translation is and when the page last changed", () => {
    const game = sitemap.find((entry) => entry.url === "https://trafal.example/en/games/orbita");
    expect(game?.alternates?.languages).toEqual({ es: "https://trafal.example/games/orbita", en: "https://trafal.example/en/games/orbita", "x-default": "https://trafal.example/games/orbita" });
    expect(game?.lastModified).toEqual(new Date("2026-11-01T10:00:00Z"));
  });
});

describe("structured data", () => {
  const owner = { username: "sofi_pixels", display_name: "Sofi Pixels" };

  it("describes the site with its search", () => {
    const data = webSiteData("es", "Una red social") as { potentialAction: { target: { urlTemplate: string } } };
    expect(data.potentialAction.target.urlTemplate).toContain("/?q={search_term_string}");
  });

  it("describes a game", () => {
    const data = gameData({ public_id: "orbita", title: "Órbita", short_description: "Gravedad", genre: "puzzle", play_count: 1469, published_at: "2026-11-01T00:00:00Z", owner }, "es");
    expect(data).toMatchObject({ "@type": "VideoGame", name: "Órbita", genre: "puzzle", isAccessibleForFree: true, gamePlatform: "Web browser" });
    expect((data.author as { name: string }).name).toBe("Sofi Pixels");
    expect(data.interactionStatistic).toMatchObject({ userInteractionCount: 1469 });
  });

  it("describes a person and an update", () => {
    expect(personData({ ...owner, bio: "Hago juegos", city: "Rosario", country: "AR" }, "en")).toMatchObject({ "@type": "ProfilePage", mainEntity: { name: "Sofi Pixels", alternateName: "@sofi_pixels" } });
    expect(postData({ id: "x", body: "Un avance", created_at: "2026-11-01T00:00:00Z", author: owner, comment_count: 2, like_count: 5 }, "es")).toMatchObject({ "@type": "SocialMediaPosting", articleBody: "Un avance" });
  });

  it("never lets what a person wrote close the script tag or break the line", () => {
    const text = serializeStructuredData({ bio: "</script><script>alert(1)</script> & \u2028 y \u2029" });
    expect(text).not.toContain("</script>");
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(text)).toEqual({ bio: "</script><script>alert(1)</script> & \u2028 y \u2029" });
  });
});
