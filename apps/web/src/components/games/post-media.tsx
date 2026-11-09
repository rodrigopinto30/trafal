import { getTranslations } from "@/i18n/server";
import type { PostMediaItem } from "@/lib/games/types";
import { mediaUrl } from "@/lib/media/url";
import { cn } from "@/lib/utils";

/**
 * Files of an update: pictures and GIFs as images (lazy, except the first one when the card is at the top of a page: `eager`), videos with controls and no autoplay (nothing downloads until someone
 * presses play). Each one keeps its own proportions so the page does not jump while it loads. One file fills the width; two or
 * more go in a grid.
 */
export async function PostMedia({ media, eager = false }: { media: PostMediaItem[]; eager?: boolean }) {
  if (media.length === 0) return null;
  const t = await getTranslations("posts");

  return (
    <ul aria-label={t("mediaLabel")} className={cn("grid gap-2", media.length > 1 && "sm:grid-cols-2")}>
      {media.map((item, index) => {
        const url = mediaUrl(item.path);
        if (!url) return null;
        const ratio = item.width && item.height ? { aspectRatio: `${item.width} / ${item.height}` } : undefined;
        return (
          <li key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            {item.kind === "video" ? (
              <video src={url} controls preload="none" playsInline aria-label={item.alt_text || t("videoLabel")} style={ratio} className="max-h-[420px] w-full bg-black object-contain">
                {t("videoUnsupported")}
              </video>
            ) : (
              <img
                src={url}
                alt={item.alt_text || (item.kind === "gif" ? t("gifFallback") : t("imageFallback"))}
                width={item.width ?? undefined}
                height={item.height ?? undefined}
                loading={eager && index === 0 ? "eager" : "lazy"}
                fetchPriority={eager && index === 0 ? "high" : undefined}
                decoding="async"
                style={ratio}
                className="max-h-[420px] w-full object-contain"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
