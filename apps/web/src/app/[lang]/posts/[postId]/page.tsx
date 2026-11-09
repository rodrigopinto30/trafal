import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentForm } from "@/components/games/comment-form";
import { CommentList, type CommentViewer } from "@/components/games/comment-list";
import { PostCard } from "@/components/games/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocale, getTranslations } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { groupComments } from "@/lib/games/comments";
import { findPostById, listCommentsByPost } from "@/lib/games/queries";
import { listMyReactions } from "@/lib/games/reaction-queries";
import { postIdSchema } from "@/lib/validation/post";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { excerpt } from "@/lib/seo/site";
import { postData } from "@/lib/seo/structured-data";

export async function generateMetadata({ params }: PageProps<"/[lang]/posts/[postId]">) {
  const id = postIdSchema.safeParse((await params).postId);
  const post = id.success ? await findPostById(id.data) : null;
  if (!post) return {};
  const locale = await getLocale();
  return pageMetadata({
    title: `${post.author.display_name}: ${excerpt(post.body, 60)}`,
    description: excerpt(post.body, 160),
    path: `/posts/${post.id}`,
    locale,
    type: "article",
    publishedTime: post.created_at,
  });
}

export default function PostPage({ params }: PageProps<"/[lang]/posts/[postId]">) {
  return (
    <div className="mx-auto max-w-[760px] px-5 pt-[clamp(24px,5vw,48px)]">
      <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
        <PostContent params={params} />
      </Suspense>
    </div>
  );
}

async function PostContent({ params }: { params: PageProps<"/[lang]/posts/[postId]">["params"] }) {
  const id = postIdSchema.safeParse((await params).postId);
  if (!id.success) notFound();
  const post = await findPostById(id.data);
  if (!post) notFound();

  const [t, tGames, comments, user, locale] = await Promise.all([getTranslations("comments"), getTranslations("games"), listCommentsByPost(post.id), getAuthUser(), getLocale()]);
  const mine = user ? await listMyReactions("post", [post.id]) : { liked: new Set<string>(), saved: new Set<string>() };
  const loginHref = `/login?next=${encodeURIComponent(`/posts/${post.id}`)}`;
  const viewer = { signedIn: Boolean(user), userId: user?.id, loginHref, mine };
  const commentViewer: CommentViewer = { signedIn: Boolean(user), userId: user?.id, isTargetOwner: user?.id === post.author_id, loginHref, target: "post", targetId: post.id };
  const now = new Date();
  const threads = groupComments(comments);

  return (
    <div className="grid gap-8">
      <JsonLd data={postData(post, locale)} />
      <PostCard post={post} now={now} viewer={viewer} />
      <section aria-labelledby="comments" className="scroll-mt-28">
        <h2 id="comments" className="font-display text-2xl font-bold">
          {t("title")}
        </h2>
        <div className="mt-4 grid gap-6">
          <CommentForm target="post" id={post.id} signedIn={Boolean(user)} loginHref={loginHref} />
          {threads.length > 0 ? (
            <CommentList threads={threads} now={now} viewer={commentViewer} />
          ) : (
            <p className="text-text-2">{user ? tGames("noCommentsSignedIn") : tGames("noComments")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
