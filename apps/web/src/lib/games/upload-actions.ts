"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { readText } from "@/lib/forms";
import { UPLOAD_URL_TTL_SECONDS, MAX_SCREENSHOTS } from "@/lib/games/upload-rules";
import { COVER_PROBLEM_KEYS, checkGameImage, discardObjects, filesOf, type CheckedImage } from "@/lib/games/game-media.server";
import { GAME_IMAGE_FORMATS, coverObjectKey, screenshotObjectKey } from "@/lib/media/game-image";
import { createQuarantineUploadUrl, putMediaObject } from "@/lib/storage/s3.server";
import { createClient } from "@/lib/supabase/server";
import { isUsageLimitError } from "@/lib/usage/limit";
import { parseLocale } from "@/lib/validation/common";
import {
  GAME_FORM_ERROR_KEYS,
  gameDetailsSchema,
  uuidSchema,
  zipDeclarationSchema,
  type GameFormErrorKey,
} from "@/lib/validation/game";
import { fieldErrorsFrom } from "@/lib/validation/text";

export type CreateGameResult =
  | { ok: true; gameId: string; publicId: string; versionId: string; uploadUrl: string }
  | { ok: false; fieldErrors: Record<string, string>; message?: string };

export type UploadStepResult = { ok: true; uploadUrl?: string } | { ok: false; message: string };

/**
 * Creates the game as a draft with its details, images and feedback questions, registers the first version and returns a
 * presigned URL so the browser can upload the zip straight to quarantine. The zip never goes through the server. Everything
 * the browser sends is validated again here; if any step fails, what was already created is undone.
 */
export async function createGameAction(formData: FormData): Promise<CreateGameResult> {
  const locale = parseLocale(formData.get("lang"));
  const t = getTranslationsFor(locale, "gameForm");
  const message = (key: GameFormErrorKey) => t(`errors.${key}`);
  const fail = (key: GameFormErrorKey, field = "form"): CreateGameResult => ({
    ok: false,
    fieldErrors: field === "form" ? {} : { [field]: message(key) },
    message: field === "form" ? message(key) : undefined,
  });

  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const details = gameDetailsSchema.safeParse({
    title: readText(formData, "title"),
    shortDescription: readText(formData, "shortDescription"),
    genre: readText(formData, "genre"),
    tags: readText(formData, "tags"),
    controls: readText(formData, "controls"),
    questions: formData.getAll("questions").filter((value): value is string => typeof value === "string"),
  });
  const zip = zipDeclarationSchema.safeParse({ zipName: readText(formData, "zipName"), zipSize: readText(formData, "zipSize") });

  const fieldErrors: Record<string, string> = {};
  if (!details.success) Object.assign(fieldErrors, fieldErrorsFrom(details.error, GAME_FORM_ERROR_KEYS, message, "generic"));
  if (!zip.success) {
    const errors = fieldErrorsFrom(zip.error, GAME_FORM_ERROR_KEYS, message, "generic");
    fieldErrors.zip = errors.zipName ?? errors.zipSize ?? message("generic");
  }

  const coverFile = filesOf(formData, "cover")[0];
  const screenshotFiles = filesOf(formData, "screenshots");
  let cover: CheckedImage | undefined;
  const screenshots: CheckedImage[] = [];
  if (coverFile) {
    const checked = await checkGameImage(coverFile);
    if (typeof checked === "string") fieldErrors.cover = message(COVER_PROBLEM_KEYS[checked]);
    else cover = checked;
  }
  if (screenshotFiles.length > MAX_SCREENSHOTS) fieldErrors.screenshots = message("tooManyScreenshots");
  else {
    for (const file of screenshotFiles) {
      const checked = await checkGameImage(file);
      if (typeof checked === "string") {
        fieldErrors.screenshots = message("screenshotsInvalid");
        break;
      }
      screenshots.push(checked);
    }
  }
  if (!details.success || !zip.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const { title, shortDescription, genre, tags, controls, questions } = details.data;
  const supabase = await createClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      owner_id: user.id,
      title,
      short_description: shortDescription,
      genre_id: genre,
      tags,
      controls,
    })
    .select("id, public_id")
    .single();
  if (gameError || !game) {
    if (isUsageLimitError(gameError)) return fail("rateLimited");
    if (gameError?.code === "42501") return fail("accountRestricted");
    console.error("[game upload] could not create the game", gameError);
    return fail("generic");
  }

  const uploadedKeys: string[] = [];
  const undo = async (key: GameFormErrorKey): Promise<CreateGameResult> => {
    await supabase.from("games").delete().eq("id", game.id);
    await discardObjects(uploadedKeys);
    return fail(key);
  };

  try {
    if (cover) {
      const key = coverObjectKey(user.id, randomBytes(16).toString("hex"), cover.format);
      await putMediaObject(key, cover.bytes, GAME_IMAGE_FORMATS[cover.format].mime);
      uploadedKeys.push(key);
      const { error } = await supabase.from("games").update({ cover_path: key }).eq("id", game.id);
      if (error) return await undo("generic");
    }
    if (screenshots.length > 0) {
      const rows: { game_id: string; path: string; position: number }[] = [];
      for (const [index, shot] of screenshots.entries()) {
        const key = screenshotObjectKey(game.id, randomBytes(16).toString("hex"), shot.format);
        await putMediaObject(key, shot.bytes, GAME_IMAGE_FORMATS[shot.format].mime);
        uploadedKeys.push(key);
        rows.push({ game_id: game.id, path: key, position: index + 1 });
      }
      const { error } = await supabase.from("game_screenshots").insert(rows);
      if (error) return await undo("generic");
    }
  } catch (error) {
    console.error("[game upload] could not store the images", error);
    return await undo("storage");
  }

  if (questions.length > 0) {
    const { error } = await supabase
      .from("game_questions")
      .insert(questions.map((question, index) => ({ game_id: game.id, position: index + 1, question })));
    if (error) return await undo("generic");
  }

  const { data: version, error: versionError } = await supabase
    .rpc("create_game_version", { p_game_id: game.id, p_declared_size_bytes: zip.data.zipSize })
    .single();
  if (versionError || !version) {
    if (versionError?.message === "daily_limit_reached") return await undo("dailyLimit");
    if (versionError?.code === "42501") return await undo("accountRestricted");
    console.error("[game upload] could not create the version", versionError);
    return await undo("generic");
  }

  let uploadUrl: string;
  try {
    uploadUrl = await createQuarantineUploadUrl(version.quarantine_key, zip.data.zipSize, UPLOAD_URL_TTL_SECONDS);
  } catch (error) {
    console.error("[game upload] could not sign the upload URL", error);
    return fail("storage");
  }

  revalidatePath("/", "layout");
  return { ok: true, gameId: game.id, publicId: game.public_id, versionId: version.version_id, uploadUrl };
}

/** The browser finished uploading the zip to quarantine: the version enters the worker queue. */
export async function confirmUploadAction(rawVersionId: unknown, rawLocale: unknown): Promise<UploadStepResult> {
  const t = getTranslationsFor(parseLocale(rawLocale), "gameForm");
  const versionId = uuidSchema.safeParse(rawVersionId);
  if (!versionId.success) return { ok: false, message: t("errors.generic") };
  if (!(await getAuthUser())) return { ok: false, message: t("errors.unauthenticated") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_version_upload", { p_version_id: versionId.data });
  if (error) {
    const key: GameFormErrorKey = error.code === "42501" ? "accountRestricted" : "generic";
    return { ok: false, message: t(`errors.${key}`) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Issues a fresh upload URL for a version that is still uploading (the first one expired or the upload failed midway). */
export async function renewUploadUrlAction(rawVersionId: unknown, rawLocale: unknown): Promise<UploadStepResult> {
  const t = getTranslationsFor(parseLocale(rawLocale), "gameForm");
  const versionId = uuidSchema.safeParse(rawVersionId);
  if (!versionId.success) return { ok: false, message: t("errors.generic") };
  if (!(await getAuthUser())) return { ok: false, message: t("errors.unauthenticated") };

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("game_versions")
    .select("status, quarantine_key, declared_size_bytes")
    .eq("id", versionId.data)
    .maybeSingle();
  if (!version || version.status !== "uploading" || !version.quarantine_key || !version.declared_size_bytes) {
    return { ok: false, message: t("errors.generic") };
  }
  try {
    return { ok: true, uploadUrl: await createQuarantineUploadUrl(version.quarantine_key, version.declared_size_bytes, UPLOAD_URL_TTL_SECONDS) };
  } catch (error) {
    console.error("[game upload] could not renew the upload URL", error);
    return { ok: false, message: t("errors.storage") };
  }
}
