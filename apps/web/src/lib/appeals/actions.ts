"use server";

import { revalidatePath } from "next/cache";
import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { APPEAL_ERROR_KEYS, counterNoticeSchema, submitAppealSchema, type AppealErrorKey } from "@/lib/validation/appeal";
import { parseLocale } from "@/lib/validation/common";

export type AppealResult = { ok: true } | { ok: false; message: string };

const DATABASE_ERRORS: [RegExp, AppealErrorKey][] = [
  [/message_required/, "messageRequired"],
  [/name_required/, "nameRequired"],
  [/invalid_email/, "invalidEmail"],
  [/statements_required/, "statementsRequired"],
  [/counter_notice_required/, "counterNoticeRequired"],
  [/not_a_claim/, "notAClaim"],
  [/nothing_to_appeal|invalid_target_type/, "nothingToAppeal"],
  [/already_appealed/, "alreadyAppealed"],
  [/too_many_open/, "tooManyOpen"],
  [/not_authenticated/, "unauthenticated"],
];

function databaseFailure(error: { message: string }, fail: (key: AppealErrorKey) => AppealResult): AppealResult {
  const known = DATABASE_ERRORS.find(([pattern]) => pattern.test(error.message));
  if (known) return fail(known[1]);
  console.error("[appeals] could not save", error);
  return fail("generic");
}

/**
 * Appeals a decision that an admin took about the signed-in person (their suspension, or something of theirs that was hidden).
 * The database decides whether there is anything to appeal, allows one appeal per decision and works for suspended accounts too.
 */
export async function submitAppealAction(rawInput: unknown, rawLocale: unknown): Promise<AppealResult> {
  const t = getTranslationsFor(parseLocale(rawLocale), "appeals");
  const fail = (key: AppealErrorKey): AppealResult => ({ ok: false, message: t(`errors.${key}`) });
  const failureOf = (error: { message: string }) => databaseFailure(error, fail);

  if (!(await getAuthUser())) return fail("unauthenticated");
  const parsed = submitAppealSchema.safeParse(rawInput);
  if (!parsed.success) {
    const reported = parsed.error.issues[0]?.message;
    return fail(APPEAL_ERROR_KEYS.find((key) => key === reported) ?? "generic");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_appeal", { p_target_type: parsed.data.targetType, p_target_id: parsed.data.targetId, p_message: parsed.data.message });
  if (error) return failureOf(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Answers a copyright claim that got something of the signed-in person hidden: why it was a mistake, their name, an email and the
 * two statements. It goes to the same queue as the appeals; the admin sees it next to the claim and writes the answer. The database
 * only accepts it for content that was hidden because of a claim.
 */
export async function submitCounterNoticeAction(rawInput: unknown, rawLocale: unknown): Promise<AppealResult> {
  const t = getTranslationsFor(parseLocale(rawLocale), "appeals");
  const fail = (key: AppealErrorKey): AppealResult => ({ ok: false, message: t(`errors.${key}`) });
  const failureOf = (error: { message: string }) => databaseFailure(error, fail);

  if (!(await getAuthUser())) return fail("unauthenticated");
  const parsed = counterNoticeSchema.safeParse(rawInput);
  if (!parsed.success) {
    const reported = parsed.error.issues[0]?.message;
    return fail(APPEAL_ERROR_KEYS.find((key) => key === reported) ?? "generic");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_counter_notice", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_message: parsed.data.message,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_good_faith: parsed.data.goodFaith,
    p_accuracy: parsed.data.accuracy,
  });
  if (error) return failureOf(error);
  revalidatePath("/", "layout");
  return { ok: true };
}
