import type { MetadataRoute } from "next";
import { listSitemapSources } from "@/lib/seo/sitemap-queries";
import { buildSitemap } from "@/lib/seo/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(await listSitemapSources());
}
