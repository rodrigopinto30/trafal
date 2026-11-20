"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/dal";
import { placeModeratedMedia, type ModeratedTarget } from "@/lib/moderation/media.server";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_ERROR_KEYS,
  clearFeaturedSchema,
  liftSuspensionSchema,
  moderateContentSchema,
  resolveClaimSchema,
  resolveReportSchema,
  setAccountRoleSchema,
  setFeaturedSchema,
  suspendAccountSchema,
  takeClaimSchema,
  takeReportSchema,
  type AdminErrorKey,
} from "@/lib/validation/admin";
import { resolveAppealSchema } from "@/lib/validation/appeal";

export type AdminResult = { ok: true } | { ok: false; error: AdminErrorKey };

const fail = (error: AdminErrorKey): AdminResult => ({ ok: false, error });

const DATABASE_ERRORS: [RegExp, AdminErrorKey][] = [
  [/not_admin/, "notAdmin"],
  [/not_authenticated/, "unauthenticated"],
  [/report_not_found/, "reportNotFound"],
  [/report_not_open/, "reportNotOpen"],
  [/report_already_resolved/, "reportAlreadyResolved"],
  [/claim_not_found/, "claimNotFound"],
  [/claim_not_open/, "claimNotOpen"],
  [/claim_already_resolved/, "claimAlreadyResolved"],
  [/appeal_not_found/, "appealNotFound"],
  [/appeal_already_resolved/, "appealAlreadyResolved"],
  [/nothing_to_hide/, "nothingToHide"],
  [/reason_required/, "reasonRequired"],
  [/account_not_found/, "accountNotFound"],
  [/cannot_suspend_self/, "cannotSuspendSelf"],
  [/cannot_suspend_admin/, "cannotSuspendAdmin"],
  [/already_suspended/, "alreadySuspended"],
  [/not_suspended/, "notSuspended"],
  [/cannot_change_own_role/, "cannotChangeOwnRole"],
  [/role_unchanged/, "roleUnchanged"],
  [/cannot_promote_suspended/, "cannotPromoteSuspended"],
  [/invalid_until/, "invalidInput"],
  [/note_too_long/, "noteTooLong"],
  [/target_not_found/, "targetNotFound"],
  [/invalid_status_for_action/, "invalidStatus"],
  [/cannot_hide_profile|invalid_target_type|invalid_action|invalid_outcome|invalid_role/, "invalidInput"],
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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Runs an admin action: the input is validated, the database decides (it checks that the caller is an admin), and, for a decision
 * that can hide or restore content, the files of what it touched are then moved to where its new state says.
 */
async function asAdmin<T>(
  rawInput: unknown,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } },
  run: (data: T, supabase: Supabase) => Promise<{ message: string; code?: string } | null>,
  touched?: (data: T, supabase: Supabase) => Promise<ModeratedTarget[]>,
): Promise<AdminResult> {
  if (!(await getAuthUser())) return fail("unauthenticated");
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return failureOfSchema(parsed.error.issues[0]);
  const supabase = await createClient();
  const error = await run(parsed.data, supabase);
  if (error) return failureOfDatabase(error);
  if (touched) await placeModeratedMedia(supabase, await touched(parsed.data, supabase));
  revalidatePath("/", "layout");
  return { ok: true };
}

function contentTarget(type: string | null | undefined, id: string | null | undefined): ModeratedTarget[] {
  return (type === "game" || type === "post") && id ? [{ type, id }] : [];
}

async function targetOfReport({ reportId }: { reportId: string }, supabase: Supabase): Promise<ModeratedTarget[]> {
  const { data } = await supabase.from("reports").select("target_type, target_id").eq("id", reportId).maybeSingle();
  return contentTarget(data?.target_type, data?.target_id);
}

async function targetsOfClaim({ claimId }: { claimId: string }, supabase: Supabase): Promise<ModeratedTarget[]> {
  const { data } = await supabase.from("copyright_claims").select("game_id, post_id").eq("id", claimId).maybeSingle();
  return [...contentTarget("game", data?.game_id), ...contentTarget("post", data?.post_id)];
}

async function targetOfAppeal({ appealId }: { appealId: string }, supabase: Supabase): Promise<ModeratedTarget[]> {
  const { data } = await supabase.from("appeals").select("target_type, target_id").eq("id", appealId).maybeSingle();
  return contentTarget(data?.target_type, data?.target_id);
}

/** Takes a report to review it. The database checks that the caller is an admin and leaves a line in the moderation log. */
export async function takeReportAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, takeReportSchema, async ({ reportId }, supabase) => (await supabase.rpc("take_report", { p_report_id: reportId })).error);
}

/** Resolves a report: dismiss it, mark it as handled, or hide the reported content and mark it as handled, all in one step. */
export async function resolveReportAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, resolveReportSchema, async ({ reportId, outcome, note }, supabase) => (await supabase.rpc("resolve_report", { p_report_id: reportId, p_outcome: outcome, p_note: note })).error, targetOfReport);
}

/** Hides or restores a game, an update or a comment, with the reason (the author is told). */
export async function moderateContentAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(
    rawInput,
    moderateContentSchema,
    async ({ targetType, targetId, action, reason }, supabase) =>
      (await supabase.rpc("moderate_content", { p_target_type: targetType, p_target_id: targetId, p_action: action, p_reason: reason })).error,
    async ({ targetType, targetId }) => contentTarget(targetType, targetId),
  );
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

const DAY_MS = 86_400_000;

/** Suspends an account for some days or until an admin lifts it. The person is told the reason; the database refuses admins and oneself. */
export async function suspendAccountAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, suspendAccountSchema, async ({ userId, reason, duration }, supabase) => {
    const until = duration === "forever" ? undefined : new Date(Date.now() + Number(duration) * DAY_MS).toISOString();
    return (await supabase.rpc("suspend_account", { p_user: userId, p_reason: reason, p_until: until })).error;
  });
}

/** Lifts the suspension of an account, with the reason (the person is told). */
export async function liftSuspensionAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, liftSuspensionSchema, async ({ userId, reason }, supabase) => (await supabase.rpc("lift_suspension", { p_user: userId, p_reason: reason })).error);
}

/**
 * Names an admin or takes the role away, with the reason (the person is told). The database refuses one's own role and a suspended
 * account, and logs it.
 */
export async function setAccountRoleAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, setAccountRoleSchema, async ({ userId, role, reason }, supabase) => (await supabase.rpc("set_account_role", { p_user: userId, p_role: role, p_reason: reason })).error);
}

/** Takes a copyright claim to review it. */
export async function takeClaimAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, takeClaimSchema, async ({ claimId }, supabase) => (await supabase.rpc("take_claim", { p_claim_id: claimId })).error);
}

/** Resolves a copyright claim: dismiss it, mark it as handled, or hide what was claimed and mark it as handled (the author is told the reason). */
export async function resolveClaimAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, resolveClaimSchema, async ({ claimId, outcome, note }, supabase) => (await supabase.rpc("resolve_claim", { p_claim_id: claimId, p_outcome: outcome, p_note: note })).error, targetsOfClaim);
}

/** Answers an appeal: keep the decision or reverse it (the suspension is lifted, the content is back), with an answer that the person reads. */
export async function resolveAppealAction(rawInput: unknown): Promise<AdminResult> {
  return asAdmin(rawInput, resolveAppealSchema, async ({ appealId, outcome, note }, supabase) => (await supabase.rpc("resolve_appeal", { p_appeal_id: appealId, p_outcome: outcome, p_note: note })).error, targetOfAppeal);
}
