"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { COMMENT_ERROR_KEYS, commentIdSchema, editCommentSchema, newCommentSchema, type CommentErrorKey } from "@/lib/validation/comment";

export type CommentResult = { ok: true } | { ok: false; error: CommentErrorKey; field?: string };

const fail = (error: CommentErrorKey, field?: string): CommentResult => ({ ok: false, error, field });

function failureOfSchema(issue: { message: string; path: PropertyKey[] } | undefined): CommentResult {
  return fail(COMMENT_ERROR_KEYS.find((key) => key === issue?.message) ?? "generic", String(issue?.path[0] ?? "form"));
}

function failureOfDatabase(error: { code?: string; message: string }): CommentResult {
  if (error.message.includes("parent_not_found")) return fail("parentNotFound");
  if (/reply_depth_exceeded|parent_target_mismatch|reply_cannot_have_label|reply_cannot_answer_question/.test(error.message)) return fail("replyNotAllowed");
  if (error.code === "42501") return fail("accountRestricted");
  console.error("[comment] database error", error);
  return fail("generic");
}

/**
 * Writes a comment on a game or an update, or a reply to a comment. The text is cleaned and checked here; the database decides
 * the rest: the author is the caller, the target has to be visible to them, an account that cannot write is refused, a reply
 * answers a published comment of the same target, only one level deep, and carries no label.
 */
export async function addCommentAction(rawInput: unknown): Promise<CommentResult> {
  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const parsed = newCommentSchema.safeParse(rawInput);
  if (!parsed.success) return failureOfSchema(parsed.error.issues[0]);
  const { target, id, parentId, label, body } = parsed.data;

  const supabase = await createClient();
  const { data: visible } =
    target === "game"
      ? await supabase.from("games").select("id").eq("id", id).maybeSingle()
      : await supabase.from("posts").select("id").eq("id", id).maybeSingle();
  if (!visible) return fail("notFound");

  const { error } = await supabase.from("comments").insert({
    author_id: user.id,
    game_id: target === "game" ? id : null,
    post_id: target === "post" ? id : null,
    parent_id: parentId,
    label,
    body,
  });
  if (error) return failureOfDatabase(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Edits the text and the label of the author's own published comment. The database refuses anyone else's, a moderated one, and a label on a reply. */
export async function updateCommentAction(rawInput: unknown): Promise<CommentResult> {
  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const parsed = editCommentSchema.safeParse(rawInput);
  if (!parsed.success) return failureOfSchema(parsed.error.issues[0]);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ body: parsed.data.body, label: parsed.data.label })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return failureOfDatabase(error);
  if (!data?.length) return fail("notFound");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Deletes the author's own comment, with the replies under it. Nobody else can: moderation goes through reports. */
export async function deleteCommentAction(rawId: unknown): Promise<CommentResult> {
  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const parsed = commentIdSchema.safeParse(rawId);
  if (!parsed.success) return fail("notFound");

  const supabase = await createClient();
  const { data, error } = await supabase.from("comments").delete().eq("id", parsed.data).select("id");
  if (error) return failureOfDatabase(error);
  if (!data?.length) return fail("notFound");
  revalidatePath("/", "layout");
  return { ok: true };
}
