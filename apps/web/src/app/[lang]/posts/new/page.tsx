import { Suspense } from "react";
import { PostForm } from "@/components/games/post-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { listGamesByOwner } from "@/lib/games/queries";
import { firstParam, parsePublicIdParam } from "@/lib/validation/common";

export async function generateMetadata() {
  const t = await getTranslations("postForm");
  return { title: t("title"), robots: { index: false } };
}

export default async function NewPostPage({ searchParams }: PageProps<"/[lang]/posts/new">) {
  const t = await getTranslations("postForm");
  return (
    <div className="mx-auto grid w-full max-w-[960px] grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-[clamp(32px,5vw,56px)]">
      <header>
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("title")}</h1>
        <p className="mt-2 text-text-2">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[560px] rounded-[28px]" />}>
        <NewPostContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewPostContent({ searchParams }: { searchParams: PageProps<"/[lang]/posts/new">["searchParams"] }) {
  const requested = parsePublicIdParam(firstParam((await searchParams).game) ?? "");
  const returnTo = requested ? `/posts/new?game=${requested}` : "/posts/new";
  const { profile } = await requireProfile(returnTo);
  const games = await listGamesByOwner(profile.id);
  const initialGameId = games.find((game) => game.public_id === requested)?.id ?? "";
  return <PostForm games={games.map(({ id, title }) => ({ id, title }))} username={profile.username} initialGameId={initialGameId} />;
}
