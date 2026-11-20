"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTranslations } from "@/i18n/client";
import { readGifsPaused, setGifsPaused, subscribeGifsPaused } from "@/lib/games/gif-motion";
import { cn } from "@/lib/utils";

const IMAGE_CLASS = "absolute inset-0 size-full object-cover";

/**
 * A game's GIF, shown in place of its cover, with a button that pauses every GIF on the site (moving content that starts on its
 * own needs a way to stop it). Paused, or for someone who asked their system to reduce motion, the cover shows instead, or the
 * generated art behind it when there is no cover.
 */
export function GameGif({ gifUrl, coverUrl }: { gifUrl: string; coverUrl: string | null }) {
  const t = useTranslations("common");
  const paused = useSyncExternalStore(subscribeGifsPaused, readGifsPaused, () => false);

  return (
    <>
      {paused ? (
        coverUrl ? (
          <img src={coverUrl} alt="" loading="lazy" decoding="async" className={IMAGE_CLASS} />
        ) : null
      ) : (
        <picture>
          {coverUrl ? <source media="(prefers-reduced-motion: reduce)" srcSet={coverUrl} /> : null}
          <img src={gifUrl} alt="" loading="lazy" decoding="async" className={cn(IMAGE_CLASS, !coverUrl && "motion-reduce:hidden")} />
        </picture>
      )}
      <button
        type="button"
        onClick={() => setGifsPaused(!paused)}
        className="absolute right-2 bottom-2 z-20 grid size-11 place-items-center rounded-full bg-black/65 text-white outline-none hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-cyan motion-reduce:hidden"
      >
        {paused ? <PlayIcon aria-hidden="true" className="size-5" /> : <PauseIcon aria-hidden="true" className="size-5" />}
        <span className="sr-only">{paused ? t("gifPlay") : t("gifPause")}</span>
      </button>
    </>
  );
}
