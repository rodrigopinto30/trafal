"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { editPostSchema, POST_ERROR_KEYS, postIdSchema } from "@/lib/validation/post";
import { discardPostFiles, type PostMutationResult } from "./post-service";

/**
 * Edits the text of the author's own update (and the highlight, only on a milestone). The kind, the game and the files do not
 * change after publishing. Row-level security decides whose update it is; a moderated update cannot be edited either.
 */
export async function updatePostAction(rawInput: unknown): Promise<PostMutationResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const parsed = editPostSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: POST_ERROR_KEYS.find((key) => key === issue?.message) ?? "generic", field: String(issue?.path[0] ?? "form") };
  }
  const { id, body, highlight } = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase.from("posts").select("kind").eq("id", id).eq("author_id", user.id).maybeSingle();
  if (!current) return { ok: false, error: "notFound" };
  if (current.kind !== "hito" && highlight !== "") return { ok: false, error: "highlightNotAllowed", field: "highlight" };

  const { data: updated, error } = await supabase
    .from("posts")
    .update({ body, highlight: highlight === "" ? null : highlight })
    .eq("id", id)
    .select("id");
  if (error || !updated?.length) {
    if (error && error.code !== "42501") console.error("[post] could not edit the update", error);
    return { ok: false, error: error?.code === "42501" || !error ? "accountRestricted" : "generic" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

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
