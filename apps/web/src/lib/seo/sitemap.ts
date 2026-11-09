import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { publicEnv } from "@/lib/env";
import { absoluteUrl, languageAlternates } from "./site";

/** Pages that are always there, with how often they change. */
const STATIC_PAGES: { path: string; changeFrequency: "daily" | "weekly" | "monthly"; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/explore", changeFrequency: "daily", priority: 0.9 },
  { path: "/creators", changeFrequency: "daily", priority: 0.8 },
  { path: "/feed", changeFrequency: "daily", priority: 0.8 },
  { path: "/legal/terms", changeFrequency: "monthly", priority: 0.2 },
  { path: "/legal/privacy", changeFrequency: "monthly", priority: 0.2 },
  { path: "/legal/guidelines", changeFrequency: "monthly", priority: 0.2 },
  { path: "/legal/copyright", changeFrequency: "monthly", priority: 0.2 },
];

export type SitemapSources = {
  games: { public_id: string; updated_at: string }[];
  creators: { username: string; updated_at: string }[];
  posts: { id: string; updated_at: string }[];
};

/** One entry per page in each language, every one saying where its translation is. */
function entries(path: string, lastModified: Date | undefined, changeFrequency: "daily" | "weekly" | "monthly", priority: number, siteUrl: string): MetadataRoute.Sitemap {
  const alternates = languageAlternates(path, siteUrl);
  return locales.map((locale) => ({ url: absoluteUrl(locale, path, siteUrl), lastModified, changeFrequency, priority, alternates: { languages: alternates } }));
}

/** The sitemap: the fixed pages plus every published game, every creator (someone with a published game) and every published update. */
export function buildSitemap(sources: SitemapSources, siteUrl: string = publicEnv.siteUrl): MetadataRoute.Sitemap {
  return [
    ...STATIC_PAGES.flatMap((page) => entries(page.path, undefined, page.changeFrequency, page.priority, siteUrl)),
    ...sources.games.flatMap((game) => entries(`/games/${game.public_id}`, new Date(game.updated_at), "weekly", 0.8, siteUrl)),
    ...sources.creators.flatMap((creator) => entries(`/u/${creator.username}`, new Date(creator.updated_at), "weekly", 0.6, siteUrl)),
    ...sources.posts.flatMap((post) => entries(`/posts/${post.id}`, new Date(post.updated_at), "monthly", 0.4, siteUrl)),
  ];
}
