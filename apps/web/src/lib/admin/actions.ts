"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_ERROR_KEYS,
  clearFeaturedSchema,
  moderateContentSchema,
  resolveReportSchema,
  setFeaturedSchema,
  takeReportSchema,
  type AdminErrorKey,
} from "@/lib/validation/admin";

export type AdminResult = { ok: true } | { ok: false; error: AdminErrorKey };

const fail = (error: AdminErrorKey): AdminResult => ({ ok: false, error });

const DATABASE_ERRORS: [RegExp, AdminErrorKey][] = [
  [/not_admin/, "notAdmin"],
  [/not_authenticated/, "unauthenticated"],
  [/report_not_found/, "reportNotFound"],
  [/report_not_open/, "reportNotOpen"],
  [/report_already_resolved/, "reportAlreadyResolved"],
  [/reason_required/, "reasonRequired"],
  [/note_too_long/, "noteTooLong"],
  [/target_not_found/, "targetNotFound"],
  [/invalid_status_for_action/, "invalidStatus"],
  [/cannot_hide_profile|invalid_target_type|invalid_action|invalid_outcome/, "invalidInput"],
  [/week_not_monday/, "weekNotMonday"],
  [/week_in_the_past/, "weekInThePast"],
  [/week_too_far/, "weekTooFar"],
  [/featured_requires_published_first_game/, "notEligible"],
  [/game_already_featured/, "alreadyFeatured"],
];

function failureOfSchema(issue: { message: string } | undefined): AdminResult {
  return fail(ADMIN_ERROR_KEYS.find((key) => key === issue?.message) ?? "invalidInput");
}

function failureOfDatabase(error: { code?: string; message: string }): AdminResult {
  const known = DATABASE_ERRORS.find(([pattern]) => pattern.test(error.message));
  if (known) return fail(known[1]);
  if (error.code === "42501") return fail("notAdmin");
  if (error.code === "23514") return fail("quoteTooLong");
  console.error("[admin] database error", error);
  return fail("generic");
}

async function asAdmin<T>(rawInput: unknown, schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, run: (data: T, supabase: Awaited<ReturnType<typeof createClient>>) => Promise<{ message: string; code?: string } | null>): Promise<AdminResult> {
  if (!(await getAuthUser())) return fail("unauthenticated");
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return failureOfSchema(parsed.error.issues[0]);
  const error = await run(parsed.data, await createClient());
  if (error) return failureOfDatabase(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Takes a report to review it. The database checks that the caller is an admin and leaves a line in the moderation log. */
export async function takeReportAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, takeReportSchema, async ({ reportId }, supabase) => (await supabase.rpc("take_report", { p_report_id: reportId })).error);
}

/** Resolves a report: dismiss it, mark it as handled, or hide the reported content and mark it as handled, all in one step. */
export async function resolveReportAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, resolveReportSchema, async ({ reportId, outcome, note }, supabase) => (await supabase.rpc("resolve_report", { p_report_id: reportId, p_outcome: outcome, p_note: note })).error);
}

/** Hides or restores a game, an update or a comment, with the reason (the author is told). */
export async function moderateContentAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, moderateContentSchema, async ({ targetType, targetId, action, reason }, supabase) => (await supabase.rpc("moderate_content", { p_target_type: targetType, p_target_id: targetId, p_action: action, p_reason: reason })).error);
}

/** Chooses the first game of a week (the current one if no week is given), with an optional quote. */
export async function setFeaturedGameAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, setFeaturedSchema, async ({ gameId, week, quote }, supabase) =>
    (await supabase.rpc("set_featured_game", { p_game_id: gameId, p_week_start: week ?? undefined, p_quote: quote })).error);
}

/** Takes off the pick of a week (the current one if no week is given). */
export async function clearFeaturedGameAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, clearFeaturedSchema, async ({ week }, supabase) => (await supabase.rpc("clear_featured_game", { p_week_start: week ?? undefined })).error);
}
