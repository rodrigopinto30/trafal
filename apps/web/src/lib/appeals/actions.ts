"use server";

import { revalidatePath } from "next/cache";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { APPEAL_ERROR_KEYS, submitAppealSchema, type AppealErrorKey } from "@/lib/validation/appeal";
import { parseLocale } from "@/lib/validation/common";

export type AppealResult = { ok: true } | { ok: false; message: string };

const DATABASE_ERRORS: [RegExp, AppealErrorKey][] = [
  [/message_required/, "messageRequired"],
  [/nothing_to_appeal|invalid_target_type/, "nothingToAppeal"],
  [/already_appealed/, "alreadyAppealed"],
  [/too_many_open/, "tooManyOpen"],
  [/not_authenticated/, "unauthenticated"],
];

/**
 * Appeals a decision that an admin took about the signed-in person (their suspension, or something of theirs that was hidden).
 * The database decides whether there is anything to appeal, allows one appeal per decision and works for suspended accounts too.
 */
export async function submitAppealAction(rawInput: unknown, rawLocale: unknown): Promise<AppealResult> {
  const t = getTranslationsFor(parseLocale(rawLocale), "appeals");
  const fail = (key: AppealErrorKey): AppealResult => ({ ok: false, message: t(`errors.${key}`) });

  if (!(await getAuthUser())) return fail("unauthenticated");
  const parsed = submitAppealSchema.safeParse(rawInput);
  if (!parsed.success) {
    const reported = parsed.error.issues[0]?.message;
    return fail(APPEAL_ERROR_KEYS.find((key) => key === reported) ?? "generic");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_appeal", { p_target_type: parsed.data.targetType, p_target_id: parsed.data.targetId, p_message: parsed.data.message });
  if (error) {
    const known = DATABASE_ERRORS.find(([pattern]) => pattern.test(error.message));
    if (known) return fail(known[1]);
    console.error("[appeals] could not save the appeal", error);
    return fail("generic");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
