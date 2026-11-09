import { Suspense } from "react";
import { NewGameForm } from "@/components/games/new-game-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { ExtraMessages } from "@/components/i18n/extra-messages";

export async function generateMetadata() {
  const t = await getTranslations("gameForm");
  return { title: t("title"), robots: { index: false } };
}

export default async function NewGamePage() {
  const t = await getTranslations("gameForm");
  return (
    <div className="mx-auto grid w-full max-w-[960px] grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-[clamp(32px,5vw,56px)]">
      <header>
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
        <p className="mt-2 text-text-2">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-[28px]" />}>
        <NewGameContent />
      </Suspense>
    </div>
  );
}

async function NewGameContent() {
  await requireProfile("/games/new");
  return (
    <ExtraMessages namespaces={["gameForm", "genres", "engines"]}>
      <NewGameForm />
    </ExtraMessages>
  );
}
