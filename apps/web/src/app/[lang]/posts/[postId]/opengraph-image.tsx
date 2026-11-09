import { findPostById } from "@/lib/games/queries";
import { OG_CONTENT_TYPE, OG_SIZE, ogLocale, ogTexts, renderCard } from "@/lib/seo/og-card";
import { excerpt } from "@/lib/seo/site";
import { postIdSchema } from "@/lib/validation/post";

export const alt = "Trafal";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ lang: string; postId: string }> }) {
  const { lang, postId } = await params;
  const t = ogTexts(ogLocale(lang));
  const id = postIdSchema.safeParse(postId);
  const post = id.success ? await findPostById(id.data) : null;
  if (!post) return renderCard({ title: t("tagline"), footer: t("playFree"), footerTone: "play" });
  return renderCard({ kicker: t("update"), title: excerpt(post.body, 110), subtitle: t("byAuthor", { name: post.author.display_name }), footer: post.game ? post.game.title : t("tagline") });
}
