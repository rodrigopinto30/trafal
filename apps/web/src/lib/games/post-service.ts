import "server-only";
import { randomBytes } from "node:crypto";
import { getAuthUser } from "@/lib/auth/dal";
import { inspectPostMedia, postMediaObjectKey, stripImageMetadata, postMediaPathPattern, POST_MEDIA_MAX_BYTES, POST_MEDIA_MAX_FILES, POST_MEDIA_MIMES, type PostMediaInfo } from "@/lib/media/post-media";
import { deleteMediaObject, putMediaObject } from "@/lib/storage/s3.server";
import { createClient } from "@/lib/supabase/server";
import { altTextSchema, newPostSchema, POST_ERROR_KEYS, type PostErrorKey } from "@/lib/validation/post";

export type CreatePostResult = { ok: true; postId: string; gamePublicId: string | null } | { ok: false; error: PostErrorKey; field?: string };

const fail = (error: PostErrorKey, field?: string): CreatePostResult => ({ ok: false, error, field });

/** Largest request that can be a valid update: every file at the cap plus a margin for the text fields and the form framing. */
export const POST_REQUEST_MAX_BYTES = POST_MEDIA_MAX_FILES * POST_MEDIA_MAX_BYTES + 1024 * 1024;

type CheckedFile = { bytes: Uint8Array; info: PostMediaInfo; alt: string };

function problemKey(problem: "invalid" | "animated" | "dimensions" | "tooLarge" | "typeMismatch"): PostErrorKey {
  return { invalid: "fileInvalid", animated: "fileAnimated", dimensions: "fileDimensions", tooLarge: "fileTooLarge", typeMismatch: "fileTypeMismatch" }[problem] as PostErrorKey;
}

async function discardObjects(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await deleteMediaObject(path);
    } catch (error) {
      console.error("[post] could not remove a file", path, error);
    }
  }
}

/**
 * Publishes an update with up to four files. Nothing is trusted: the fields go through Zod, every file is inspected byte by
 * byte (real format, size, dimensions, no animated pictures, nothing glued behind) and stripped of photo metadata such as GPS
 * position, the game has to be one of the author's
 * own published games, and the database enforces the author, the account state and the shape of every stored path. If any
 * step fails after the update exists, the update and the files already stored are removed, so a failure leaves nothing behind.
 */
export async function createPost(form: FormData): Promise<CreatePostResult> {
  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const parsed = newPostSchema.safeParse({
    kind: form.get("kind"),
    body: form.get("body") ?? undefined,
    highlight: form.get("highlight") ?? "",
    gameId: form.get("gameId") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = POST_ERROR_KEYS.find((candidate) => candidate === issue?.message) ?? "generic";
    return fail(key, String(issue?.path[0] ?? "form"));
  }
  const fields = parsed.data;

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > POST_MEDIA_MAX_FILES) return fail("tooManyFiles", "files");
  const alts = form.getAll("alt").map((value) => (typeof value === "string" ? value : ""));

  const checked: CheckedFile[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size > POST_MEDIA_MAX_BYTES) return fail("fileTooLarge", "files");
    if (!POST_MEDIA_MIMES.includes(file.type)) return fail("fileInvalid", "files");
    const alt = altTextSchema.safeParse(alts[index] ?? "");
    if (!alt.success) return fail("altTooLong", "files");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = inspectPostMedia(bytes, file.type);
    if (!inspected.ok) return fail(problemKey(inspected.problem), "files");
    checked.push({ bytes: stripImageMetadata(bytes, inspected.info.format), info: inspected.info, alt: alt.data });
  }

  const supabase = await createClient();
  let gamePublicId: string | null = null;
  if (fields.gameId) {
    const { data: game } = await supabase.from("games").select("public_id").eq("id", fields.gameId).eq("owner_id", user.id).eq("status", "published").maybeSingle();
    if (!game) return fail("invalidGame", "gameId");
    gamePublicId = game.public_id;
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, kind: fields.kind, body: fields.body, game_id: fields.gameId, highlight: fields.highlight })
    .select("id")
    .single();
  if (error || !post) {
    if (error?.code === "42501") return fail("accountRestricted");
    console.error("[post] could not save the update", error);
    return fail("generic");
  }

  const stored: string[] = [];
  const rollback = async (reason: PostErrorKey): Promise<CreatePostResult> => {
    await supabase.from("posts").delete().eq("id", post.id);
    await discardObjects(stored);
    return fail(reason);
  };

  for (const [index, file] of checked.entries()) {
    const path = postMediaObjectKey(post.id, randomBytes(16).toString("hex"), file.info.format);
    try {
      await putMediaObject(path, file.bytes, file.info.mime);
    } catch (storageError) {
      console.error("[post] could not store a file", storageError);
      return rollback("storage");
    }
    stored.push(path);
    const { error: mediaError } = await supabase.from("post_media").insert({
      post_id: post.id,
      kind: file.info.kind,
      path,
      mime: file.info.mime,
      bytes: file.bytes.length,
      width: file.info.width,
      height: file.info.height,
      alt_text: file.alt,
      position: index + 1,
    });
    if (mediaError) {
      console.error("[post] could not save a file's row", mediaError);
      return rollback("generic");
    }
  }

  return { ok: true, postId: post.id, gamePublicId };
}

/** Removes the files of an update from storage, only the ones that really live in that update's folder. */
export async function discardPostFiles(postId: string, paths: string[]): Promise<void> {
  const pattern = postMediaPathPattern(postId);
  await discardObjects(paths.filter((path) => pattern.test(path)));
}

export type PostMutationResult = { ok: true } | { ok: false; error: PostErrorKey; field?: string };
