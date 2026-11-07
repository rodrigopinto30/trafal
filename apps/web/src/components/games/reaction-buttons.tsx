"use client";

import { BookmarkIcon, HeartIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { formatCompactNumber } from "@/lib/format";
import { setReactionAction } from "@/lib/games/reaction-actions";
import { cn } from "@/lib/utils";
import type { ReactionKind, ReactionTarget } from "@/lib/validation/reaction";

type Props = {
  target: ReactionTarget;
  id: string;
  likeCount: number;
  initialLiked: boolean;
  initialSaved: boolean;
  signedIn: boolean;
  loginHref: string;
  locale: string;
  compact?: boolean;
};

/**
 * «Like» and «Save» buttons of a game or a post. They answer at once and are corrected if the server disagrees (the count that
 * comes back is the real one). Visitors without an account are sent to log in and come back to the same page.
 */
export function ReactionButtons({ target, id, likeCount, initialLiked, initialSaved, signedIn, loginHref, locale, compact = false }: Props) {
  const t = useTranslations("reactions");
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(likeCount);
  const [pending, startTransition] = useTransition();

  const size = compact ? "h-11 min-w-11 px-3" : "h-11 px-4";
  const countLabel = formatCompactNumber(locale, count);

  function toggle(kind: ReactionKind) {
    const wasActive = kind === "like" ? liked : saved;
    const apply = (active: boolean) => (kind === "like" ? setLiked(active) : setSaved(active));
    apply(!wasActive);
    if (kind === "like") setCount((current) => Math.max(0, current + (wasActive ? -1 : 1)));
    startTransition(async () => {
      const result = await setReactionAction({ target, kind, id, active: !wasActive });
      if (result.ok) {
        apply(result.active);
        if (kind === "like") setCount(result.count);
        return;
      }
      apply(wasActive);
      if (kind === "like") setCount((current) => Math.max(0, current + (wasActive ? 1 : -1)));
      toast.error(t(`errors.${result.reason}`));
    });
  }

  if (!signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" className={size}>
          <Link href={loginHref} title={t("loginToLike")}>
            <HeartIcon aria-hidden="true" className="text-coral" />
            <span className="sr-only">{t("like")}</span>
            <span>{countLabel}</span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="icon">
          <Link href={loginHref} aria-label={t("save")} title={t("loginToSave")}>
            <BookmarkIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={liked ? "like" : "outline"}
        className={cn(size, liked && "border border-coral/40")}
        aria-pressed={liked}
        disabled={pending}
        onClick={() => toggle("like")}
      >
        <HeartIcon aria-hidden="true" className={cn("text-coral", liked && "fill-coral")} />
        <span className="sr-only">{t("like")}</span>
        <span>{countLabel}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(saved && "border-cyan/70 bg-cyan/15 text-cyan")}
        aria-pressed={saved}
        aria-label={t("save")}
        title={saved ? t("saved") : t("save")}
        disabled={pending}
        onClick={() => toggle("save")}
      >
        <BookmarkIcon aria-hidden="true" className={cn(saved && "fill-cyan")} />
      </Button>
    </div>
  );
}
