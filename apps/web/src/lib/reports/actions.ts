"use server";

import { getTranslationsFor } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/validation/common";
import { REPORT_ERROR_KEYS, reportSchema, type ReportErrorKey } from "@/lib/validation/report";

export type ReportResult = { ok: true } | { ok: false; message: string };

/**
 * Reports a game, an update, a comment or a profile for review. Needs an account (so reports can be told apart and abuse
 * limited). The database enforces who can report and what (only published content), keeps a copy of the content as it was at
 * the time, and does not allow two open reports of the same thing from the same person.
 */
export async function reportContentAction(rawInput: unknown, rawLocale: unknown): Promise<ReportResult> {
  const t = getTranslationsFor(parseLocale(rawLocale), "report");
  const fail = (key: ReportErrorKey): ReportResult => ({ ok: false, message: t(`errors.${key}`) });

  const user = await getAuthUser();
  if (!user) return fail("unauthenticated");

  const parsed = reportSchema.safeParse(rawInput);
  if (!parsed.success) {
    const reported = parsed.error.issues[0]?.message;
    return fail(REPORT_ERROR_KEYS.find((key) => key === reported) ?? "generic");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    detail: parsed.data.detail,
  });
  if (error) {
    if (error.code === "23505") return fail("alreadyReported");
    if (error.code === "42501") return fail("accountRestricted");
    if (error.message.includes("report_target_not_found")) return fail("targetNotFound");
    console.error("[report] could not save the report", error);
    return fail("generic");
  }
  return { ok: true };
}
