import { findProfileSeo } from "@/lib/games/queries";
import { OG_CONTENT_TYPE, OG_SIZE, ogLocale, ogTexts, renderCard } from "@/lib/seo/og-card";
import { parseUsernameParam } from "@/lib/validation/common";
import { createClient } from "@/lib/supabase/server";

export const alt = "Trafal";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ lang: string; username: string }> }) {
  const { lang, username: rawUsername } = await params;
  const t = ogTexts(ogLocale(lang));
  const username = parseUsernameParam(rawUsername);
  const profile = username ? await findProfileSeo(username) : null;
  if (!profile) return renderCard({ title: t("tagline"), footer: t("playFree"), footerTone: "play" });

  const supabase = await createClient();
  const { data: row } = await supabase.from("profiles").select("id, followers_count").eq("username", profile.username).maybeSingle();
  const { count: games } = row ? await supabase.from("games").select("id", { count: "exact", head: true }).eq("status", "published").eq("owner_id", row.id) : { count: 0 };
  return renderCard({ title: profile.display_name, subtitle: `@${profile.username}`, footer: `${t("games", { count: games ?? 0 })} · ${t("followers", { count: row?.followers_count ?? 0 })}` });
}
