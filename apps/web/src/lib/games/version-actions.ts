"use server";

import { revalidatePath } from "next/cache";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { UPLOAD_URL_TTL_SECONDS } from "@/lib/games/upload-rules";
import { createQuarantineUploadUrl } from "@/lib/storage/s3.server";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/validation/common";
import {
  VERSION_ERROR_KEYS,
  editVersionSchema,
  newVersionSchema,
  uuidSchema,
  zipDeclarationSchema,
  type VersionErrorKey,
} from "@/lib/validation/game";
import { fieldErrorsFrom } from "@/lib/validation/text";

export type CreateVersionResult =
  | { ok: true; versionId: string; uploadUrl: string }
  | { ok: false; fieldErrors: Record<string, string>; message?: string };

export type VersionResult = { ok: true } | { ok: false; message: string };

function translator(rawLocale: unknown) {
  const t = getTranslationsFor(parseLocale(rawLocale), "gameVersions");
  return (key: VersionErrorKey) => t(`errors.${key}`);
}

/**
 * Registers a new version of one of the caller's games and returns a presigned URL to upload its zip to quarantine. The
 * database checks ownership, the active account, the size and the daily quota; the browser then uploads the zip and confirms
 * it with confirmUploadAction, exactly like the first version of a game.
 */
export async function createVersionAction(formData: FormData): Promise<CreateVersionResult> {
  const message = translator(formData.get("lang"));
  const fail = (key: VersionErrorKey): CreateVersionResult => ({ ok: false, fieldErrors: {}, message: message(key) });

  if (!(await getAuthUser())) return fail("unauthenticated");

  const details = newVersionSchema.safeParse({
    gameId: formData.get("gameId"),
    label: formData.get("label") ?? "",
    changelog: formData.get("changelog") ?? "",
  });
  const zip = zipDeclarationSchema.safeParse({ zipName: formData.get("zipName"), zipSize: formData.get("zipSize") });
  const fieldErrors: Record<string, string> = {};
  if (!details.success) Object.assign(fieldErrors, fieldErrorsFrom(details.error, VERSION_ERROR_KEYS, message, "generic"));
  if (!zip.success) {
    const errors = fieldErrorsFrom(zip.error, VERSION_ERROR_KEYS, message, "generic");
    fieldErrors.zip = errors.zipName ?? errors.zipSize ?? message("generic");
  }
  if (!details.success || !zip.success) return { ok: false, fieldErrors };

  const supabase = await createClient();
  const { data: version, error } = await supabase
    .rpc("create_game_version", {
      p_game_id: details.data.gameId,
      p_declared_size_bytes: zip.data.zipSize,
      p_label: details.data.label,
      p_changelog: details.data.changelog,
    })
    .single();
  if (error || !version) {
    if (error?.message === "daily_limit_reached") return fail("dailyLimit");
    if (error?.message === "game_not_found") return fail("gameNotFound");
    if (error?.message === "invalid_size") return fail("zipTooLarge");
    if (error?.code === "42501") return fail("accountRestricted");
    console.error("[version] could not create the version", error);
    return fail("generic");
  }

  try {
    const uploadUrl = await createQuarantineUploadUrl(version.quarantine_key, zip.data.zipSize, UPLOAD_URL_TTL_SECONDS);
    revalidatePath("/", "layout");
    return { ok: true, versionId: version.version_id, uploadUrl };
  } catch (signError) {
    console.error("[version] could not sign the upload URL", signError);
    return fail("storage");
  }
}

/** Renames a version and edits its changelog. RLS limits it to the owner's own versions and these two columns. */
export async function updateVersionAction(rawInput: unknown, rawLocale: unknown): Promise<VersionResult> {
  const message = translator(rawLocale);
  if (!(await getAuthUser())) return { ok: false, message: message("unauthenticated") };

  const parsed = editVersionSchema.safeParse(rawInput);
  if (!parsed.success) {
    const reported = parsed.error.issues[0]?.message;
    return { ok: false, message: message(VERSION_ERROR_KEYS.find((key) => key === reported) ?? "generic") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_versions")
    .update({ label: parsed.data.label, changelog: parsed.data.changelog })
    .eq("id", parsed.data.versionId)
    .select("id");
  if (error || !data?.length) return { ok: false, message: message(data?.length === 0 ? "versionNotFound" : "generic") };

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Makes a ready version the one people play. The database function checks that it is a ready version of the caller's game. */
export async function activateVersionAction(rawVersionId: unknown, rawLocale: unknown): Promise<VersionResult> {
  const message = translator(rawLocale);
  if (!(await getAuthUser())) return { ok: false, message: message("unauthenticated") };
  const versionId = uuidSchema.safeParse(rawVersionId);
  if (!versionId.success) return { ok: false, message: message("generic") };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_version", { p_version_id: versionId.data });
  if (error) {
    if (error.message === "version_not_ready") return { ok: false, message: message("versionNotReady") };
    if (error.message === "version_not_found") return { ok: false, message: message("versionNotFound") };
    if (error.code === "42501") return { ok: false, message: message("accountRestricted") };
    console.error("[version] could not switch the active version", error);
    return { ok: false, message: message("generic") };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
