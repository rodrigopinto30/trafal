"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { readText } from "@/lib/forms";
import { COVER_PROBLEM_KEYS, checkGameImage, discardObjects, filesOf, type CheckedImage } from "@/lib/games/game-media.server";
import { MAX_SCREENSHOTS } from "@/lib/games/upload-rules";
import { GAME_IMAGE_FORMATS, coverObjectKey, screenshotObjectKey } from "@/lib/media/game-image";
import { putMediaObject } from "@/lib/storage/s3.server";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/validation/common";
import { GAME_FORM_ERROR_KEYS, gameDetailsSchema, uuidSchema, type GameFormErrorKey } from "@/lib/validation/game";
import { fieldErrorsFrom } from "@/lib/validation/text";

export type EditGameResult = { ok: true; publicId: string } | { ok: false; fieldErrors: Record<string, string>; message?: string };

/**
 * Saves the changes the owner made to a draft or published game: details, feedback questions, cover (keep, replace or remove)
 * and screenshots (remove some, add new ones). Everything the browser sends is validated again here; the new
 * images are stored first and, if the database rejects the edit, they are removed again. The images that the edit replaced
 * or dropped are deleted only after the edit succeeded, so a failure never leaves the game without a picture it still points at.
 */
export async function updateGameAction(formData: FormData): Promise<EditGameResult> {
  const locale = parseLocale(formData.get("lang"));
  const t = getTranslationsFor(locale, "gameForm");
  const message = (key: GameFormErrorKey) => t(`errors.${key}`);
  const fail = (key: GameFormErrorKey, field = "form"): EditGameResult => ({
    ok: false,
    fieldErrors: field === "form" ? {} : { [field]: message(key) },
    message: field === "form" ? message(key) : undefined,
  });

  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");
  const gameId = uuidSchema.safeParse(readText(formData, "gameId"));
  if (!gameId.success) return fail("gameNotEditable");

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("id, public_id, cover_path")
    .eq("id", gameId.data)
    .eq("owner_id", user.id)
    .in("status", ["draft", "published"])
    .maybeSingle();
  if (!game) return fail("gameNotEditable");
  const { data: currentShots } = await supabase.from("game_screenshots").select("id, path, alt_text").eq("game_id", game.id).order("position");

  const details = gameDetailsSchema.safeParse({
    title: readText(formData, "title"),
    shortDescription: readText(formData, "shortDescription"),
    genre: readText(formData, "genre"),
    tags: readText(formData, "tags"),
    controls: readText(formData, "controls"),
    questions: formData.getAll("questions").filter((value): value is string => typeof value === "string"),
  });
  const fieldErrors: Record<string, string> = {};
  if (!details.success) Object.assign(fieldErrors, fieldErrorsFrom(details.error, GAME_FORM_ERROR_KEYS, message, "generic"));

  const dropIds = new Set(formData.getAll("dropScreenshots").filter((value): value is string => typeof value === "string"));
  const keptShots = (currentShots ?? []).filter((shot) => !dropIds.has(shot.id));
  const droppedShots = (currentShots ?? []).filter((shot) => dropIds.has(shot.id));

  const coverFile = filesOf(formData, "cover")[0];
  const screenshotFiles = filesOf(formData, "screenshots");
  let cover: CheckedImage | undefined;
  const screenshots: CheckedImage[] = [];
  if (coverFile) {
    const checked = await checkGameImage(coverFile);
    if (typeof checked === "string") fieldErrors.cover = message(COVER_PROBLEM_KEYS[checked]);
    else cover = checked;
  }
  if (keptShots.length + screenshotFiles.length > MAX_SCREENSHOTS) fieldErrors.screenshots = message("tooManyScreenshots");
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
  if (!details.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const uploadedKeys: string[] = [];
  let coverPath = formData.get("removeCover") === "1" ? null : game.cover_path;
  const newScreenshotPaths: string[] = [];
  try {
    if (cover) {
      coverPath = coverObjectKey(user.id, randomBytes(16).toString("hex"), cover.format);
      await putMediaObject(coverPath, cover.bytes, GAME_IMAGE_FORMATS[cover.format].mime);
      uploadedKeys.push(coverPath);
    }
    for (const shot of screenshots) {
      const key = screenshotObjectKey(game.id, randomBytes(16).toString("hex"), shot.format);
      await putMediaObject(key, shot.bytes, GAME_IMAGE_FORMATS[shot.format].mime);
      uploadedKeys.push(key);
      newScreenshotPaths.push(key);
    }
  } catch (error) {
    console.error("[game edit] could not store the images", error);
    await discardObjects(uploadedKeys);
    return fail("storage");
  }

  const { title, shortDescription, genre, tags, controls, questions } = details.data;
  const { error } = await supabase.rpc("edit_game", {
    p_game_id: game.id,
    p_title: title,
    p_short_description: shortDescription,
    p_genre_id: genre,
    p_tags: tags,
    p_controls: controls,
    p_cover_path: coverPath as string,
    p_screenshots: [
      ...keptShots.map((shot) => ({ path: shot.path, alt_text: shot.alt_text })),
      ...newScreenshotPaths.map((path) => ({ path, alt_text: "" })),
    ],
    p_questions: questions,
  });
  if (error) {
    await discardObjects(uploadedKeys);
    if (error.code === "42501") return fail("accountRestricted");
    if (error.message === "game_not_found") return fail("gameNotEditable");
    console.error("[game edit] could not save the game", error);
    return fail("generic");
  }

  const replacedCover = game.cover_path && game.cover_path !== coverPath ? [game.cover_path] : [];
  await discardObjects([...replacedCover, ...droppedShots.map((shot) => shot.path)]);
  revalidatePath("/", "layout");
  return { ok: true, publicId: game.public_id };
}
