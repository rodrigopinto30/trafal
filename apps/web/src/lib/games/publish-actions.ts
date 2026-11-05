"use server";

import { revalidatePath } from "next/cache";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/validation/common";
import { gameVisibilitySchema } from "@/lib/validation/game";

export type PublishResult = { ok: true } | { ok: false; message: string };

/**
 * Publishes a game or sends it back to draft. Only the owner can (RLS), and the database refuses to publish a game
 * that has no ready version, so the button being visible is a convenience, not the rule.
 */
export async function setGameVisibilityAction(rawGameId: unknown, rawStatus: unknown, rawLocale: unknown): Promise<PublishResult> {
  const t = getTranslationsFor(parseLocale(rawLocale), "gameManage");
  const parsed = gameVisibilitySchema.safeParse({ gameId: rawGameId, status: rawStatus });
  if (!parsed.success) return { ok: false, message: t("errors.generic") };
  if (!(await getAuthUser())) return { ok: false, message: t("errors.generic") };

  const supabase = await createClient();
  const { data, error } = await supabase.from("games").update({ status: parsed.data.status }).eq("id", parsed.data.gameId).select("id");
  if (error) {
    const notReady = error.message === "publish_requires_ready_version";
    return { ok: false, message: t(notReady ? "errors.notReady" : "errors.generic") };
  }
  if (!data?.length) return { ok: false, message: t("errors.generic") };

  revalidatePath("/", "layout");
  return { ok: true };
}
