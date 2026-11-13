import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/games/auto-refresh";
import { NewVersionForm } from "@/components/games/new-version-form";
import { PublishControls } from "@/components/games/publish-controls";
import { PublishStatus, type PublishStage } from "@/components/games/publish-status";
import { VersionControls } from "@/components/games/version-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { formatBytes } from "@/lib/format";
import { findOwnGame, listVersionsOfGame } from "@/lib/games/queries";
import { isUploadErrorCode, uploadErrorParams } from "@/lib/games/upload-error";
import { parsePublicIdParam } from "@/lib/validation/common";
import { ExtraMessages } from "@/components/i18n/extra-messages";

type ManagePageProps = PageProps<"/[lang]/games/[publicId]/manage">;

export async function generateMetadata() {
  const t = await getTranslations("gameManage");
  return { title: t("title"), robots: { index: false } };
}

export default function ManageGamePage({ params }: ManagePageProps) {
  return (
    <div className="mx-auto w-full max-w-[960px] px-5 pt-[clamp(32px,5vw,56px)]">
      <ExtraMessages namespaces={["gameForm", "gameVersions"]}>
        <Suspense fallback={<Skeleton className="h-[360px] rounded-[28px]" />}>
          <ManageContent params={params} />
        </Suspense>
      </ExtraMessages>
    </div>
  );
}

const VERSION_TONE = { uploading: "cyan", processing: "violet", ready: "cyan", error: "coral" } as const satisfies Record<string, StatusTone>;
const GAME_TONE = { draft: "neutral", published: "cyan", hidden: "coral", removed: "coral" } as const satisfies Record<string, StatusTone>;
type VersionStatus = keyof typeof VERSION_TONE;

function isVersionStatus(value: string): value is VersionStatus {
  return value in VERSION_TONE;
}

async function ManageContent({ params }: { params: ManagePageProps["params"] }) {
  const publicId = parsePublicIdParam((await params).publicId);
  if (!publicId) notFound();
  const { user, profile } = await requireProfile(`/games/${publicId}/manage`);
  const game = await findOwnGame(publicId, user.id);
  if (!game) notFound();

  const [t, tVersions, tErrors, locale, versions] = await Promise.all([
    getTranslations("gameManage"),
    getTranslations("gameVersions"),
    getTranslations("uploadErrors"),
    getLocale(),
    listVersionsOfGame(game.id),
  ]);
  const inProgress = versions.some((version) => version.status === "uploading" || version.status === "processing");
  const gameStatus = (["draft", "published", "hidden", "removed"] as const).find((status) => status === game.status) ?? "draft";
  const hasReadyVersion = game.active_version_id !== null && versions.some((version) => version.id === game.active_version_id && version.status === "ready");
  const canToggle = (gameStatus === "draft" && hasReadyVersion) || gameStatus === "published";
  const canEdit = gameStatus === "draft" || gameStatus === "published";
  const waitingStage: PublishStage = versions.some((version) => version.status === "processing")
    ? "processing"
    : versions.some((version) => version.status === "uploading")
      ? "uploading"
      : "failed";

  return (
    <div className="grid gap-8">
      <AutoRefresh active={inProgress} />
      <header className="grid gap-3">
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{game.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={GAME_TONE[gameStatus]}>{t(`status.${gameStatus}`)}</StatusBadge>
          {canEdit ? (
            <Button asChild variant="outline">
              <Link href={`/games/${game.public_id}/edit`}>{t("editDetails")}</Link>
            </Button>
          ) : null}
        </div>
        <p className="text-text-2">{t(`note.${gameStatus === "draft" && hasReadyVersion ? "draftReady" : gameStatus}`)}</p>
        {canToggle ? (
          <PublishControls
            gameId={game.id}
            published={gameStatus === "published"}
            publishLabel={t("publish")}
            unpublishLabel={t("unpublish")}
            pendingLabel={t("saving")}
          />
        ) : null}
        {gameStatus === "draft" && !hasReadyVersion ? (
          <PublishStatus
            stage={waitingStage}
            labels={{
              title: t(`progress.${waitingStage}.title`),
              text: t(`progress.${waitingStage}.text`),
              steps: { uploaded: t("progress.steps.uploaded"), review: t("progress.steps.review"), publish: t("progress.steps.publish") },
              stepState: {
                done: t("progress.stepState.done"),
                current: t("progress.stepState.current"),
                waiting: t("progress.stepState.waiting"),
                failed: t("progress.stepState.failed"),
              },
              publishLabel: t("publish"),
              publishHint: t("progress.publishHint"),
            }}
          />
        ) : null}
      </header>

      <section aria-labelledby="versions-title" className="grid gap-4 rounded-[28px] border border-white/8 bg-card p-6 sm:p-8">
        <div>
          <h2 id="versions-title" className="font-display text-xl font-bold">
            {t("versionsTitle")}
          </h2>
          <p className="mt-1 text-sm text-text-2">{t("versionsHint")}</p>
        </div>
        <ul className="grid gap-4">
          {versions.map((version) => {
            const status: VersionStatus = isVersionStatus(version.status) ? version.status : "error";
            return (
              <li key={version.id} className="grid gap-2 rounded-2xl border border-white/10 bg-white/4 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold">{t("versionName", { label: version.label })}</h3>
                  <StatusBadge tone={VERSION_TONE[status]} live={status === "uploading" || status === "processing"}>
                    {t(`versionStatus.${status}`)}
                  </StatusBadge>
                  {version.id === game.active_version_id ? <StatusBadge tone="neutral">{t("activeBadge")}</StatusBadge> : null}
                </div>
                <p className="text-sm text-text-2" role={status === "error" ? "alert" : undefined}>
                  {t(`versionText.${status}`)}
                </p>
                {status === "error" ? (
                  <p className="text-sm font-medium text-[#ffb3c1]">
                    {isUploadErrorCode(version.error_code)
                      ? tErrors(version.error_code, uploadErrorParams(locale, version.error_code, version.error_params))
                      : t("unknownError")}
                  </p>
                ) : null}
                {version.changelog ? (
                  <p className="text-sm whitespace-pre-line text-text-2">
                    <span className="font-semibold text-text">{t("changelogLabel")}: </span>
                    {version.changelog}
                  </p>
                ) : null}
                {version.declared_size_bytes ? <p className="text-xs text-text-3">{t("size", { size: formatBytes(locale, version.declared_size_bytes) })}</p> : null}
                <VersionControls
                  versionId={version.id}
                  label={version.label}
                  changelog={version.changelog}
                  canActivate={status === "ready" && version.id !== game.active_version_id}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {gameStatus === "draft" || gameStatus === "published" ? (
        <section aria-labelledby="new-version-title" className="grid gap-4 rounded-[28px] border border-white/8 bg-card p-6 sm:p-8">
          <div>
            <h2 id="new-version-title" className="font-display text-xl font-bold">
              {tVersions("newTitle")}
            </h2>
            <p className="mt-1 text-sm text-text-2">{tVersions("newHelp")}</p>
            <p className="mt-1 text-sm text-text-3">{t("newVersionHint")}</p>
          </div>
          <NewVersionForm gameId={game.id} />
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" size="lg">
          <Link href={`/u/${profile.username}`}>{t("backToProfile")}</Link>
        </Button>
        <Button asChild size="lg">
          <Link href="/games/new">{t("uploadAnother")}</Link>
        </Button>
      </div>
    </div>
  );
}
