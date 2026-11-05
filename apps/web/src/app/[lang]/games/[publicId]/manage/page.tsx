import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/games/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getLocale, getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { formatBytes } from "@/lib/format";
import { findOwnGame, listVersionsOfGame } from "@/lib/games/queries";
import { isUploadErrorCode, uploadErrorParams } from "@/lib/games/upload-error";
import { parsePublicIdParam } from "@/lib/validation/common";

type ManagePageProps = PageProps<"/[lang]/games/[publicId]/manage">;

export async function generateMetadata() {
  const t = await getTranslations("gameManage");
  return { title: t("title"), robots: { index: false } };
}

export default function ManageGamePage({ params }: ManagePageProps) {
  return (
    <div className="mx-auto w-full max-w-[960px] px-5 pt-[clamp(32px,5vw,56px)]">
      <Suspense fallback={<Skeleton className="h-[360px] rounded-[28px]" />}>
        <ManageContent params={params} />
      </Suspense>
    </div>
  );
}

const VERSION_BADGE = { uploading: "cyan", processing: "violet", ready: "lime", error: "coral" } as const;
type VersionStatus = keyof typeof VERSION_BADGE;

function isVersionStatus(value: string): value is VersionStatus {
  return value in VERSION_BADGE;
}

async function ManageContent({ params }: { params: ManagePageProps["params"] }) {
  const publicId = parsePublicIdParam((await params).publicId);
  if (!publicId) notFound();
  const { user, profile } = await requireProfile(`/games/${publicId}/manage`);
  const game = await findOwnGame(publicId, user.id);
  if (!game) notFound();

  const [t, tErrors, locale, versions] = await Promise.all([
    getTranslations("gameManage"),
    getTranslations("uploadErrors"),
    getLocale(),
    listVersionsOfGame(game.id),
  ]);
  const inProgress = versions.some((version) => version.status === "uploading" || version.status === "processing");
  const gameStatus = (["draft", "published", "hidden", "removed"] as const).find((status) => status === game.status) ?? "draft";

  return (
    <div className="grid gap-8">
      <AutoRefresh active={inProgress} />
      <header className="grid gap-3">
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{game.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={gameStatus === "published" ? "lime" : "soft"}>{t(`status.${gameStatus}`)}</Badge>
        </div>
        {gameStatus === "draft" ? <p className="text-text-2">{t("draftNote")}</p> : null}
      </header>

      <section aria-labelledby="versions-title" className="grid gap-4 rounded-[28px] border border-white/8 bg-card p-6 sm:p-8">
        <h2 id="versions-title" className="font-display text-xl font-bold">
          {t("versionsTitle")}
        </h2>
        <ul className="grid gap-4">
          {versions.map((version) => {
            const status: VersionStatus = isVersionStatus(version.status) ? version.status : "error";
            return (
              <li key={version.id} className="grid gap-2 rounded-2xl border border-white/10 bg-white/4 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold">{t("versionName", { label: version.label })}</h3>
                  <Badge variant={VERSION_BADGE[status]}>{t(`versionStatus.${status}`)}</Badge>
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
                {version.declared_size_bytes ? <p className="text-xs text-text-3">{t("size", { size: formatBytes(locale, version.declared_size_bytes) })}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>

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
