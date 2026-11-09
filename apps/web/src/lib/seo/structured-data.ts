import type { Locale } from "@/i18n/config";
import { SITE_NAME, absoluteUrl, excerpt } from "./site";

type Json = Record<string, unknown>;

/** The site itself, with the search box that search engines can offer next to the result. */
export function webSiteData(locale: Locale, description: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl(locale, "/"),
    description,
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(locale, "/explore")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

type GameData = { public_id: string; title: string; short_description: string; genre: string | null; play_count: number; published_at: string | null; owner: { username: string; display_name: string } };

/** A browser game: what it is, who made it, how to play it and how many times it has been played. */
export function gameData(game: GameData, locale: Locale): Json {
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: excerpt(game.short_description, 300),
    url: absoluteUrl(locale, `/games/${game.public_id}`),
    applicationCategory: "Game",
    operatingSystem: "Any (web browser)",
    gamePlatform: "Web browser",
    playMode: "SinglePlayer",
    inLanguage: locale,
    isAccessibleForFree: true,
    ...(game.genre ? { genre: game.genre } : {}),
    ...(game.published_at ? { datePublished: game.published_at } : {}),
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD", availability: "https://schema.org/InStock" },
    author: { "@type": "Person", name: game.owner.display_name, url: absoluteUrl(locale, `/u/${game.owner.username}`) },
    interactionStatistic: { "@type": "InteractionCounter", interactionType: { "@type": "PlayAction" }, userInteractionCount: game.play_count },
  };
}

type PersonData = { username: string; display_name: string; bio: string; city: string | null; country: string | null; created_at?: string };

/** The profile of a person: a page about someone, so search engines know who it is about. */
export function personData(person: PersonData, locale: Locale): Json {
  const url = absoluteUrl(locale, `/u/${person.username}`);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    ...(person.created_at ? { dateCreated: person.created_at } : {}),
    mainEntity: {
      "@type": "Person",
      name: person.display_name,
      alternateName: `@${person.username}`,
      url,
      ...(person.bio ? { description: excerpt(person.bio, 300) } : {}),
      ...(person.country ? { homeLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: person.country, ...(person.city ? { addressLocality: person.city } : {}) } } } : {}),
    },
  };
}

type PostData = { id: string; body: string; created_at: string; author: { username: string; display_name: string }; comment_count: number; like_count: number };

/** An update posted by someone. */
export function postData(post: PostData, locale: Locale): Json {
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    url: absoluteUrl(locale, `/posts/${post.id}`),
    articleBody: excerpt(post.body, 500),
    datePublished: post.created_at,
    author: { "@type": "Person", name: post.author.display_name, url: absoluteUrl(locale, `/u/${post.author.username}`) },
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: { "@type": "LikeAction" }, userInteractionCount: post.like_count },
      { "@type": "InteractionCounter", interactionType: { "@type": "CommentAction" }, userInteractionCount: post.comment_count },
    ],
  };
}

/** The data as the text of a `<script type="application/ld+json">`: nothing a person wrote can close the tag or break the line. */
export function serializeStructuredData(data: Json): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
