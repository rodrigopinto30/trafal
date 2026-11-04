import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProfileList, type PersonRow } from "@/components/profile/profile-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/link";
import { getTranslations } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { parseUsernameParam } from "@/lib/validation/common";

const PAGE_SIZE = 60;

export async function generateMetadata({ params }: PageProps<"/[lang]/u/[username]/following">) {
  const { username } = await params;
  const t = await getTranslations("profile");
  return { title: t("followingTitle", { username: parseUsernameParam(username) ?? "" }) };
}

export default function Page({ params }: PageProps<"/[lang]/u/[username]/following">) {
  return (
    <div className="mx-auto max-w-[960px] px-5 pt-[clamp(24px,5vw,48px)]">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/[lang]/u/[username]/following">["params"] }) {
  // Un @usuario con forma imposible (o con percent-encoding roto) no puede existir: 404 sin consultar la base.
  const username = parseUsernameParam((await params).username);
  if (!username) notFound();
  const t = await getTranslations("profile");
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("id, username").eq("username", username).maybeSingle();
  if (!profile) notFound();

  const { data } = await supabase
    .from("follows")
    .select("created_at, followee:profiles!follows_followee_id_fkey(username, display_name, avatar_path, bio)")
    .eq("follower_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  const people: PersonRow[] = (data ?? []).flatMap((row) => (row.followee ? [row.followee] : []));

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" className="-ml-3">
          <Link href={`/u/${profile.username}`}>← {t("backToProfile")}</Link>
        </Button>
        <h1 className="mt-2 font-display text-[clamp(26px,4.5vw,36px)] leading-tight font-bold text-glow-violet">
          {t("followingTitle", { username: profile.username })}
        </h1>
      </div>
      <ProfileList people={people} emptyText={t("noFollowing")} />
    </div>
  );
}
