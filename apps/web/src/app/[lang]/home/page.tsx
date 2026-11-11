import { Suspense } from "react";
import { SignedInHome } from "@/components/home/signed-in-home";
import { SignedInSkeleton } from "@/components/home/signed-in-skeleton";
import { getLocale, getTranslations } from "@/i18n/server";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  const [t, locale] = await Promise.all([getTranslations("meta"), getLocale()]);
  return pageMetadata({ title: t("defaultTitle"), description: t("description"), path: "/", locale, titleIsComplete: true, noindex: true });
}

/**
 * The home of someone who signed in. People never type this address: the proxy serves it at «/» when there is a valid session, so
 * the visitors' home stays static and untouched. If someone does open «/home» with no session, they get the public home.
 */
export default function SignedInHomePage() {
  return (
    <Suspense fallback={<SignedInSkeleton />}>
      <SignedInHome />
    </Suspense>
  );
}
