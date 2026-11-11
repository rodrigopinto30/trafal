import { Suspense } from "react";
import { HomeContent } from "@/components/home/home-content";
import { HomeSkeleton } from "@/components/home/home-skeleton";
import { getLocale, getTranslations } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("meta"), getLocale()]);
  return pageMetadata({ title: t("defaultTitle"), description: t("description"), path: "/", locale, titleIsComplete: true, noindex: true });
}

/**
 * People never type this address: the proxy serves it at «/» when there is a valid session or when the address asks for a search
 * (`/?q=…`), so the public home stays static and untouched. Opened by hand with no session and nothing searched, it shows the public home.
 */
export default function HomePage({ searchParams }: PageProps<"/[lang]/home">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
