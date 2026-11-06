"use server";

import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/validation/common";
import { REPORT_ERROR_KEYS, reportGameSchema, type ReportErrorKey } from "@/lib/validation/report";

export type ReportResult = { ok: true } | { ok: false; message: string };

/**
 * Reports a game for review. Needs an account (so reports can be told apart and abuse limited). The database enforces who
 * can report and keeps a copy of the game as it was at the time; the same person cannot have two open reports of one game.
 */
export async function reportGameAction(rawInput: unknown, rawLocale: unknown): Promise<ReportResult> {
  const t = getTranslationsFor(parseLocale(rawLocale), "gamePlayer");
  const fail = (key: ReportErrorKey): ReportResult => ({ ok: false, message: t(`report.errors.${key}`) });

  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const parsed = reportGameSchema.safeParse(rawInput);
  if (!parsed.success) {
    const reported = parsed.error.issues[0]?.message;
    return fail(REPORT_ERROR_KEYS.find((key) => key === reported) ?? "generic");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: "game",
    target_id: parsed.data.gameId,
    reason: parsed.data.reason,
    detail: parsed.data.detail,
  });
  if (error) {
    if (error.code === "23505") return fail("alreadyReported");
    if (error.code === "42501") return fail("accountRestricted");
    console.error("[report] could not save the report", error);
    return fail("generic");
  }
  return { ok: true };
}
