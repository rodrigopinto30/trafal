import { AutoRefresh } from "@/components/games/auto-refresh";
import { GameVisibilityControls, type GameVisibilityLabels } from "@/components/games/game-visibility-controls";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { PLAYER_WIDTH } from "@/lib/games/player-size";
import type { GameVisibility } from "@/lib/games/queries";

type Stage = "published" | "ready" | "reviewing" | "failed";

type Props = {
  game: { id: string; public_id: string; status: GameVisibility; active_version_id: string | null };
  versionStatuses: string[];
  justUploaded: boolean;
};

function stageOf(status: GameVisibility, activeVersionId: string | null, versionStatuses: string[]): Stage {
  if (status === "published") return "published";
  if (activeVersionId) return "ready";
  return versionStatuses.some((version) => version === "uploading" || version === "processing") ? "reviewing" : "failed";
}

/** The texts of the publish / take down button and its dialogs, for the pages that show it. */
export async function gameVisibilityLabels(): Promise<GameVisibilityLabels> {
  const [t, tc] = await Promise.all([getTranslations("gameOwner"), getTranslations("common")]);
  return {
    publish: t("publish"),
    publishing: t("publishing"),
    unpublish: t("unpublish"),
    unpublishing: t("unpublishing"),
    published: t("publishedToast"),
    unpublished: t("unpublishedToast"),
    cancel: t("cancel"),
    close: tc("close"),
    unpublishTitle: t("unpublishTitle"),
    unpublishText: t("unpublishText"),
    readyTitle: t("readyTitle"),
    readyText: t("readyText"),
    readyLater: t("readyLater"),
  };
}

/**
 * What only the owner sees on their game's page, right above the player so it is always in sight: whether it is published or a
 * draft, the button to publish it or take it down, and the way to edit it and manage its versions. While a zip is being
 * reviewed it refreshes itself until it can be published.
 */
export async function OwnerPanel({ game, versionStatuses, justUploaded }: Props) {
  const [t, labels] = await Promise.all([getTranslations("gameOwner"), gameVisibilityLabels()]);
  const stage = stageOf(game.status, game.active_version_id, versionStatuses);
  const canToggle = stage === "published" || stage === "ready";

  return (
    <section
      aria-labelledby="owner-panel-title"
      className="mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-3xl border border-violet/30 bg-card px-5 py-4"
      style={{ width: PLAYER_WIDTH }}
    >
      <AutoRefresh active={stage === "reviewing"} />
      <div className="grid min-w-0 flex-1 basis-[320px] gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="owner-panel-title" className="font-display text-lg font-bold">
            {t("title")}
          </h2>
          <StatusBadge tone={game.status === "published" ? "cyan" : "neutral"} live={stage === "reviewing"}>
            {t(`status.${game.status}`)}
          </StatusBadge>
        </div>
        <p className="text-sm text-text-2">{t(`note.${stage}`)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {canToggle ? <GameVisibilityControls gameId={game.id} published={stage === "published"} justUploaded={justUploaded} labels={labels} /> : null}
        <Button asChild variant="outline" size="lg">
          <Link href={`/games/${game.public_id}/edit`}>{t("edit")}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={`/games/${game.public_id}/manage`}>{t("versions")}</Link>
        </Button>
      </div>
    </section>
  );
}
