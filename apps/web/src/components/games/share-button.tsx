"use client";

import { Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/i18n/client";
import { localizePath } from "@/i18n/path";
import { publicEnv } from "@/lib/env";

type Props = { path: string; title: string };

/**
 * «Share» button of a game or an update: it opens the share sheet of the device when there is one and otherwise copies the
 * public link. The link always points at this site's own address for that page, in the language the person is reading.
 */
export function ShareButton({ path, title }: Props) {
  const t = useTranslations("share");
  const locale = useLocale();

  async function share() {
    const url = new URL(localizePath(locale, path), publicEnv.siteUrl).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(t("failed"));
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("failed"));
    }
  }

  return (
    <Button type="button" variant="ghost" size="icon" aria-label={t("label")} title={t("label")} onClick={share}>
      <Share2Icon aria-hidden="true" />
    </Button>
  );
}
