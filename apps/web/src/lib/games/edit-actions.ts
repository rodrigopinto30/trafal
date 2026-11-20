"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { readText } from "@/lib/forms";
import { COVER_PROBLEM_KEYS, GIF_PROBLEM_KEYS, checkGameGif, checkGameImage, discardObjects, filesOf, type CheckedImage } from "@/lib/games/game-media.server";
import { isTitleTaken } from "@/lib/games/title";
import { GAME_GIF_MIME, GAME_IMAGE_FORMATS, coverObjectKey, gifObjectKey } from "@/lib/media/game-image";
import { putMediaObject } from "@/lib/storage/s3.server";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/validation/common";
import { GAME_FORM_ERROR_KEYS, gameDetailsSchema, uuidSchema, type GameFormErrorKey } from "@/lib/validation/game";
import { fieldErrorsFrom } from "@/lib/validation/text";

export type EditGameResult = { ok: true; publicId: string } | { ok: false; fieldErrors: Record<string, string>; message?: string };

/**
 * Saves the changes the owner made to a draft or published game: details, feedback questions, cover and GIF (each one kept,
 * replaced or removed). Everything the browser sends is validated again here; the new pictures are stored first and, if the
 * database rejects the edit, they are removed again. The pictures that the edit replaced or removed are deleted only after the
 * edit succeeded, so a failure never leaves the game without a picture it still points at.
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
    .select("id, public_id, cover_path, gif_path")
    .eq("id", gameId.data)
    .eq("owner_id", user.id)
    .in("status", ["draft", "published"])
    .maybeSingle();
  if (!game) return fail("gameNotEditable");

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

  const coverFile = filesOf(formData, "cover")[0];
  const gifFile = filesOf(formData, "gif")[0];
  let cover: CheckedImage | undefined;
  let gif: Uint8Array | undefined;
  if (coverFile) {
    const checked = await checkGameImage(coverFile);
    if (typeof checked === "string") fieldErrors.cover = message(COVER_PROBLEM_KEYS[checked]);
    else cover = checked;
  }
  if (gifFile) {
    const checked = await checkGameGif(gifFile);
    if (typeof checked === "string") fieldErrors.gif = message(GIF_PROBLEM_KEYS[checked]);
    else gif = checked;
  }
  if (!details.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const uploadedKeys: string[] = [];
  let coverPath = formData.get("removeCover") === "1" ? null : game.cover_path;
  let gifPath = formData.get("removeGif") === "1" ? null : game.gif_path;
  try {
    if (cover) {
      coverPath = coverObjectKey(user.id, randomBytes(16).toString("hex"), cover.format);
      await putMediaObject(coverPath, cover.bytes, GAME_IMAGE_FORMATS[cover.format].mime);
      uploadedKeys.push(coverPath);
    }
    if (gif) {
      gifPath = gifObjectKey(user.id, randomBytes(16).toString("hex"));
      await putMediaObject(gifPath, gif, GAME_GIF_MIME);
      uploadedKeys.push(gifPath);
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
    p_gif_path: gifPath as string,
    p_questions: questions,
  });
  if (error) {
    await discardObjects(uploadedKeys);
    if (error.code === "42501") return fail("accountRestricted");
    if (isTitleTaken(error)) return fail("titleTaken", "title");
    if (error.message === "game_not_found") return fail("gameNotEditable");
    console.error("[game edit] could not save the game", error);
    return fail("generic");
  }

  const replaced = [game.cover_path !== coverPath ? game.cover_path : null, game.gif_path !== gifPath ? game.gif_path : null];
  await discardObjects(replaced.filter((key): key is string => key !== null));
  revalidatePath("/", "layout");
  return { ok: true, publicId: game.public_id };
}
