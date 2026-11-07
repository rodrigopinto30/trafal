"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { postIdSchema } from "@/lib/validation/post";
import { discardPostFiles, type PostMutationResult } from "./post-service";

/**
 * Deletes the author's own update with its likes, saves, comments and files. The files are read before the row goes (they
 * are deleted with it) and removed from storage afterwards; a storage failure at that point leaves an orphan file, never
 * an update that cannot be deleted.
 */
export async function deletePostAction(rawId: unknown): Promise<PostMutationResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const parsed = postIdSchema.safeParse(rawId);
  if (!parsed.success) return { ok: false, error: "notFound" };
  const id = parsed.data;

  const supabase = await createClient();
  const { data: mine } = await supabase.from("posts").select("id").eq("id", id).eq("author_id", user.id).maybeSingle();
  if (!mine) return { ok: false, error: "notFound" };
  const { data: media } = await supabase.from("post_media").select("path").eq("post_id", id);

  const { data: removed, error } = await supabase.from("posts").delete().eq("id", id).select("id");
  if (error || !removed?.length) {
    if (error && error.code !== "42501") console.error("[post] could not delete the update", error);
    return { ok: false, error: !error || error.code === "42501" ? "accountRestricted" : "generic" };
  }
  await discardPostFiles(id, (media ?? []).map((row) => row.path));
  revalidatePath("/", "layout");
  return { ok: true };
}
