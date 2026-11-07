import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/dal";
import {
  inspectPostMedia,
  postMediaObjectKey,
  postMediaPathPattern,
  POST_MEDIA_MAX_BYTES,
  POST_MEDIA_MAX_FILES,
  POST_MEDIA_MIMES,
  stripImageMetadata,
  type PostMediaInfo,
} from "@/lib/media/post-media";
import { deleteMediaObject, putMediaObject } from "@/lib/storage/s3.server";
import { createClient } from "@/lib/supabase/server";
import { altTextSchema, newPostSchema, POST_ERROR_KEYS, postIdSchema, type PostErrorKey } from "@/lib/validation/post";

export type PostSaveResult = { ok: true; postId: string; gamePublicId: string | null } | { ok: false; error: PostErrorKey; field?: string };
export type PostMutationResult = { ok: true } | { ok: false; error: PostErrorKey; field?: string };

const fail = (error: PostErrorKey, field?: string): { ok: false; error: PostErrorKey; field?: string } => ({ ok: false, error, field });

/** Largest request that can be a valid update: every file at the cap plus a margin for the text fields and the form framing. */
export const POST_REQUEST_MAX_BYTES = POST_MEDIA_MAX_FILES * POST_MEDIA_MAX_BYTES + 1024 * 1024;

type Supabase = Awaited<ReturnType<typeof createClient>>;
type PostFields = z.infer<typeof newPostSchema>;
type CheckedFile = { bytes: Uint8Array; info: PostMediaInfo; alt: string };
type MediaRow = { kind: string; path: string; mime: string; bytes: number; width: number | null; height: number | null; alt_text: string };

/** The final list of files of an edited update, in order: files that stay (by id) and files that are new (by their place in the upload). */
const mediaPlanSchema = z
  .array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("keep"), id: z.uuid(), alt: z.string() }),
      z.object({ type: z.literal("new"), index: z.number().int().min(0), alt: z.string() }),
    ]),
  )
  .max(POST_MEDIA_MAX_FILES);

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

function readFields(form: FormData): { ok: true; fields: PostFields } | { ok: false; error: PostErrorKey; field: string } {
  const parsed = newPostSchema.safeParse({
    kind: form.get("kind"),
    body: form.get("body") ?? undefined,
    highlight: form.get("highlight") ?? "",
    gameId: form.get("gameId") ?? "",
  });
  if (parsed.success) return { ok: true, fields: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, error: POST_ERROR_KEYS.find((candidate) => candidate === issue?.message) ?? "generic", field: String(issue?.path[0] ?? "form") };
}

/** Inspects every uploaded file byte by byte and strips photo metadata; the answer is the files to store or the first problem found. */
async function inspectUploads(files: File[], alts: string[]): Promise<{ ok: true; checked: CheckedFile[] } | { ok: false; error: PostErrorKey; field: string }> {
  if (files.length > POST_MEDIA_MAX_FILES) return { ok: false, error: "tooManyFiles", field: "files" };
  const checked: CheckedFile[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size > POST_MEDIA_MAX_BYTES) return { ok: false, error: "fileTooLarge", field: "files" };
    if (!POST_MEDIA_MIMES.includes(file.type)) return { ok: false, error: "fileInvalid", field: "files" };
    const alt = altTextSchema.safeParse(alts[index] ?? "");
    if (!alt.success) return { ok: false, error: "altTooLong", field: "files" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = inspectPostMedia(bytes, file.type);
    if (!inspected.ok) return { ok: false, error: problemKey(inspected.problem), field: "files" };
    checked.push({ bytes: stripImageMetadata(bytes, inspected.info.format), info: inspected.info, alt: alt.data });
  }
  return { ok: true, checked };
}

function uploadedFiles(form: FormData): File[] {
  return form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

async function ownPublishedGame(supabase: Supabase, userId: string, gameId: string): Promise<string | null> {
  const { data } = await supabase.from("games").select("public_id").eq("id", gameId).eq("owner_id", userId).eq("status", "published").maybeSingle();
  return data?.public_id ?? null;
}

async function storeFile(postId: string, file: CheckedFile, stored: string[]): Promise<string | null> {
  const path = postMediaObjectKey(postId, randomBytes(16).toString("hex"), file.info.format);
  try {
    await putMediaObject(path, file.bytes, file.info.mime);
  } catch (error) {
    console.error("[post] could not store a file", error);
    return null;
  }
  stored.push(path);
  return path;
}

/**
 * Publishes an update with up to four files. Nothing is trusted: the fields go through Zod, every file is inspected byte by
 * byte (real format, size, dimensions, no animated pictures, nothing glued behind) and stripped of photo metadata such as GPS
 * position, the game has to be one of the author's own published games, and the database enforces the author, the account
 * state and the shape of every stored path. If any step fails after the update exists, the update and the files already
 * stored are removed, so a failure leaves nothing behind.
 */
export async function createPost(form: FormData): Promise<PostSaveResult> {
  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const read = readFields(form);
  if (!read.ok) return fail(read.error, read.field);
  const fields = read.fields;

  const inspected = await inspectUploads(uploadedFiles(form), form.getAll("alt").map((value) => (typeof value === "string" ? value : "")));
  if (!inspected.ok) return fail(inspected.error, inspected.field);

  const supabase = await createClient();
  let gamePublicId: string | null = null;
  if (fields.gameId) {
    gamePublicId = await ownPublishedGame(supabase, user.id, fields.gameId);
    if (!gamePublicId) return fail("invalidGame", "gameId");
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
  const rollback = async (reason: PostErrorKey) => {
    await supabase.from("posts").delete().eq("id", post.id);
    await discardObjects(stored);
    return fail(reason);
  };

  for (const [index, file] of inspected.checked.entries()) {
    const path = await storeFile(post.id, file, stored);
    if (!path) return rollback("storage");
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

/**
 * Saves an edited update: kind, game, text, highlight and the final list of files (keep some, drop some, add new ones, any
 * order, new descriptions). New files are inspected and stored first; then the database replaces the fields and the file
 * list in ONE transaction (`edit_post`), so a failure never leaves half an edit. If it fails, the files just stored are
 * removed; if it works, the files that are no longer part of the update are removed. Row-level security decides who may edit.
 */
export async function updatePost(rawPostId: unknown, form: FormData): Promise<PostSaveResult> {
  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const postId = postIdSchema.safeParse(rawPostId);
  if (!postId.success) return fail("notFound");

  const read = readFields(form);
  if (!read.ok) return fail(read.error, read.field);
  const fields = read.fields;

  let plan: z.infer<typeof mediaPlanSchema>;
  try {
    plan = mediaPlanSchema.parse(JSON.parse(String(form.get("media") ?? "[]")));
  } catch {
    return fail("invalidMedia", "files");
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("posts").select("game_id").eq("id", postId.data).eq("author_id", user.id).maybeSingle();
  if (!current) return fail("notFound");
  const { data: rows } = await supabase
    .from("post_media")
    .select("id, kind, path, mime, bytes, width, height, alt_text")
    .eq("post_id", postId.data);
  const existing = new Map((rows ?? []).map((row) => [row.id, row]));

  const files = uploadedFiles(form);
  const keptIds = plan.flatMap((item) => (item.type === "keep" ? [item.id] : []));
  const newIndexes = plan.flatMap((item) => (item.type === "new" ? [item.index] : []));
  const valid =
    new Set(keptIds).size === keptIds.length &&
    keptIds.every((id) => existing.has(id)) &&
    new Set(newIndexes).size === newIndexes.length &&
    newIndexes.length === files.length &&
    newIndexes.every((index) => index < files.length);
  if (!valid) return fail("invalidMedia", "files");

  const alts = files.map((_, position) => {
    const item = plan.find((entry) => entry.type === "new" && entry.index === position);
    return item?.alt ?? "";
  });
  const inspected = await inspectUploads(files, alts);
  if (!inspected.ok) return fail(inspected.error, inspected.field);
  for (const item of plan) {
    if (item.type === "keep" && !altTextSchema.safeParse(item.alt).success) return fail("altTooLong", "files");
  }

  let gamePublicId: string | null = null;
  if (fields.gameId) {
    gamePublicId = await ownPublishedGame(supabase, user.id, fields.gameId);
    const unchanged = fields.gameId === current.game_id;
    if (!gamePublicId && !unchanged) return fail("invalidGame", "gameId");
    if (!gamePublicId) gamePublicId = await findPublicId(supabase, fields.gameId);
  }

  const stored: string[] = [];
  const items: (MediaRow & { alt_text: string })[] = [];
  for (const item of plan) {
    if (item.type === "keep") {
      const row = existing.get(item.id);
      if (row) items.push({ ...row, alt_text: altTextSchema.parse(item.alt) });
      continue;
    }
    const file = inspected.checked[item.index];
    if (!file) return fail("invalidMedia", "files");
    const path = await storeFile(postId.data, file, stored);
    if (!path) {
      await discardObjects(stored);
      return fail("storage");
    }
    items.push({ kind: file.info.kind, path, mime: file.info.mime, bytes: file.bytes.length, width: file.info.width, height: file.info.height, alt_text: file.alt });
  }

  const { error } = await supabase.rpc("edit_post", {
    p_post_id: postId.data,
    p_kind: fields.kind,
    p_body: fields.body,
    p_game_id: fields.gameId as string,
    p_highlight: fields.highlight as string,
    p_media: items,
  });
  if (error) {
    await discardObjects(stored);
    if (error.code === "42501") return fail("accountRestricted");
    if (error.message.includes("post_not_found")) return fail("notFound");
    if (error.message.includes("game_not_owned")) return fail("invalidGame", "gameId");
    console.error("[post] could not edit the update", error);
    return fail("generic");
  }

  const kept = new Set(items.map((item) => item.path));
  const removed = [...existing.values()].map((row) => row.path).filter((path) => !kept.has(path));
  await discardPostFiles(postId.data, removed);
  return { ok: true, postId: postId.data, gamePublicId };
}

async function findPublicId(supabase: Supabase, gameId: string): Promise<string | null> {
  const { data } = await supabase.from("games").select("public_id").eq("id", gameId).maybeSingle();
  return data?.public_id ?? null;
}

/** Removes the files of an update from storage, only the ones that really live in that update's folder. */
export async function discardPostFiles(postId: string, paths: string[]): Promise<void> {
  const pattern = postMediaPathPattern(postId);
  await discardObjects(paths.filter((path) => pattern.test(path)));
}
