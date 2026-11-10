import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { publicEnv } from "@/lib/env";
import { isPublicSite } from "./site";

/** Pages and areas that are private or of no use in a search: the account, the forms to create things and the technical routes. */
const CLOSED_PATHS = ["/settings", "/saved", "/notifications", "/admin", "/posts/new", "/posts/*/edit", "/games/new", "/games/*/manage", "/onboarding", "/login", "/signup", "/forgot-password", "/reset-password"];

/** The robots.txt of the site. A site that is not public (localhost, staging) is closed to every crawler; the public one is open except for the private areas, and points at the sitemap. */
export function buildRobots(siteUrl: string = publicEnv.siteUrl): MetadataRoute.Robots {
  if (!isPublicSite(siteUrl)) return { rules: { userAgent: "*", disallow: "/" } };
  const closed = locales.flatMap((locale) => CLOSED_PATHS.map((path) => (locale === "es" ? path : `/${locale}${path}`)));
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", ...closed] },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
