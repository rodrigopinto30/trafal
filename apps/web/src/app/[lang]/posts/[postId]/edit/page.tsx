import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostForm } from "@/components/games/post-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "@/i18n/server";
import { requireProfile } from "@/lib/auth/dal";
import { findOwnPostForEdit, listGamesByOwner } from "@/lib/games/queries";
import { mediaUrl } from "@/lib/media/url";
import { postIdSchema } from "@/lib/validation/post";

export async function generateMetadata() {
  const t = await getTranslations("postForm");
  return { title: t("edit.title"), robots: { index: false } };
}

export default async function EditPostPage({ params }: PageProps<"/[lang]/posts/[postId]/edit">) {
  const t = await getTranslations("postForm");
  return (
    <div className="mx-auto grid w-full max-w-[960px] grid-cols-[minmax(0,1fr)] gap-6 px-5 pt-[clamp(32px,5vw,56px)]">
      <header>
        <h1 className="font-display text-[clamp(30px,5vw,44px)] leading-[1.1] font-bold text-glow-violet">{t("edit.title")}</h1>
        <p className="mt-2 text-text-2">{t("edit.subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[560px] rounded-[28px]" />}>
        <EditPostContent params={params} />
      </Suspense>
    </div>
  );
}

async function EditPostContent({ params }: { params: PageProps<"/[lang]/posts/[postId]/edit">["params"] }) {
  const parsed = postIdSchema.safeParse((await params).postId);
  if (!parsed.success) notFound();
  const { user, profile } = await requireProfile(`/posts/${parsed.data}/edit`);
  const [post, games] = await Promise.all([findOwnPostForEdit(parsed.data, user.id), listGamesByOwner(profile.id)]);
  if (!post) notFound();

  const options = games.map(({ id, title }) => ({ id, title }));
  if (post.game && !options.some((option) => option.id === post.game?.id)) options.push(post.game);
  return (
    <PostForm
      key={post.updated_at}
      games={options}
      username={profile.username}
      initialGameId=""
      editing={{
        id: post.id,
        kind: post.kind,
        body: post.body,
        highlight: post.highlight ?? "",
        gameId: post.game?.id ?? "",
        media: post.media.flatMap((item) => {
          const url = mediaUrl(item.path);
          return url ? [{ id: item.id, kind: item.kind, url, alt: item.alt_text }] : [];
        }),
      }}
    />
  );
}
