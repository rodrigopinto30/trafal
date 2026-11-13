import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditGameForm } from "@/components/games/edit-game-form";
import { ExtraMessages } from "@/components/i18n/extra-messages";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { findEditableGame } from "@/lib/games/queries";
import { mediaUrl } from "@/lib/media/url";
import { parsePublicIdParam } from "@/lib/validation/common";

type EditGamePageProps = PageProps<"/[lang]/games/[publicId]/edit">;

export async function generateMetadata() {
  const t = await getTranslations("gameEdit");
  return { title: t("title"), robots: { index: false } };
}

export default async function EditGamePage({ params }: EditGamePageProps) {
  const t = await getTranslations("gameEdit");
  return (
    <div className="mx-auto grid w-full max-w-[960px] grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-[clamp(32px,5vw,56px)]">
      <header>
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
        <p className="mt-2 text-text-2">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-[28px]" />}>
        <EditGameContent params={params} />
      </Suspense>
    </div>
  );
}

async function EditGameContent({ params }: { params: EditGamePageProps["params"] }) {
  const publicId = parsePublicIdParam((await params).publicId);
  if (!publicId) notFound();
  const { user } = await requireProfile(`/games/${publicId}/edit`);
  const game = await findEditableGame(publicId, user.id);
  if (!game) notFound();

  return (
    <ExtraMessages namespaces={["gameForm", "gameEdit", "genres"]}>
      <EditGameForm
        key={game.updated_at}
        game={{
          id: game.id,
          publicId: game.public_id,
          title: game.title,
          shortDescription: game.short_description,
          genreId: game.genre_id,
          tags: game.tags,
          controls: game.controls,
          questions: game.questions,
          coverUrl: mediaUrl(game.cover_path),
          screenshots: game.screenshots.flatMap((shot) => {
            const url = mediaUrl(shot.path);
            return url ? [{ id: shot.id, url }] : [];
          }),
        }}
      />
    </ExtraMessages>
  );
}
