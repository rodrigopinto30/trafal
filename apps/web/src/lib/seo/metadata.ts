import type { Metadata } from "next";
import { type Locale } from "@/i18n/config";
import { SITE_NAME, absoluteUrl, languageAlternates } from "./site";

type PageSeo = {
  title: string;
  description: string;
  path: string;
  locale: Locale;
  titleIsComplete?: boolean;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  publishedTime?: string;
};

const OPEN_GRAPH_LOCALES: Record<Locale, string> = { es: "es_AR", en: "en_US" };

/**
 * Everything a search engine or a social network wants to know about a page, in one place: the title and the description, the
 * canonical address (always the clean one: filters, pages and searches point at the base page), the same page in each language,
 * the Open Graph and Twitter cards (the image comes from the `opengraph-image` file of the route) and whether to index it.
 */
export function pageMetadata({ title, description, path, locale, titleIsComplete = false, type = "website", noindex = false, publishedTime }: PageSeo): Metadata {
  const url = absoluteUrl(locale, path);
  const cardTitle = titleIsComplete ? title : `${SITE_NAME} - ${title}`;
  return {
    title: titleIsComplete ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      title: cardTitle,
      description,
      locale: OPEN_GRAPH_LOCALES[locale],
      alternateLocale: Object.entries(OPEN_GRAPH_LOCALES).filter(([key]) => key !== locale).map(([, value]) => value),
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: cardTitle, description },
  };
}
