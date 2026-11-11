"use client";

import { ArrowLeftIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";
import { stripLocale } from "@/i18n/path";

/** Whether there is a previous page in this tab to go back to (the Navigation API knows; older browsers only know how long the history is). */
function canGoBack(): boolean {
  const navigation = (window as unknown as { navigation?: { canGoBack?: boolean } }).navigation;
  return typeof navigation?.canGoBack === "boolean" ? navigation.canGoBack : window.history.length > 1;
}

/**
 * The «Back» button under the top bar of every section (the home has nowhere to go back to). It goes to the previous page; if the
 * section was opened directly, in a new tab, it goes to the home instead of doing nothing. It reads the route, so it goes inside
 * a <Suspense>.
 */
export function BackButton() {
  const t = useTranslations("common");
  const router = useRouter();
  const { path } = stripLocale(usePathname());
  if (path === "/") return null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pt-3">
      <Button type="button" variant="ghost" className="-ml-3" onClick={() => (canGoBack() ? router.back() : router.push("/"))}>
        <ArrowLeftIcon aria-hidden="true" />
        {t("backButton")}
      </Button>
    </div>
  );
}
