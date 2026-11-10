"use server";

import { getTranslationsFor } from "@/i18n/server";
import { readText, type FormState } from "@/lib/forms";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { CLAIM_ERROR_KEYS, claimFormSchema, parseSiteTarget, type ClaimErrorKey } from "@/lib/validation/claims";
import { parseLocale } from "@/lib/validation/common";
import { fieldErrorsFrom } from "@/lib/validation/text";

const FIELDS = ["claimantName", "claimantEmail", "claimantOrg", "workDescription", "originalUrl", "urls", "statementGoodFaith", "statementAccuracy", "signature"] as const;
const REFERENCE_LENGTH = 8;

/**
 * Sends a copyright claim. Anyone can (no account needed): the form is public, so the data is cleaned and checked here and the
 * database checks it again. The links are turned into what they point at on this site (a game or an update that is published);
 * the database refuses a claim that points at nothing and one that comes too often from the same email or from everybody.
 */
export async function submitCopyrightClaimAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const t = getTranslationsFor(parseLocale(formData.get("lang")), "claims");
  const message = (key: ClaimErrorKey) => t(`errors.${key}`);
  const values = Object.fromEntries(FIELDS.map((field) => [field, readText(formData, field)]));

  const parsed = claimFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error, CLAIM_ERROR_KEYS, message, "generic"), values };
  }
  const claim = parsed.data;

  const origin = new URL(publicEnv.siteUrl).origin;
  const targets = claim.urls.map((link) => parseSiteTarget(link, origin)).filter((target) => target !== null);
  const publicIds = targets.flatMap((target) => (target.type === "game" ? [target.publicId] : []));
  const postIds = targets.flatMap((target) => (target.type === "post" ? [target.postId] : []));

  const supabase = await createClient();
  const [game, post] = await Promise.all([
    publicIds.length > 0 ? supabase.from("games").select("id").in("public_id", publicIds).eq("status", "published").limit(1).maybeSingle() : { data: null },
    postIds.length > 0 ? supabase.from("posts").select("id").in("id", postIds).eq("status", "published").limit(1).maybeSingle() : { data: null },
  ]);
  if (!game.data && !post.data) return { status: "error", fieldErrors: { urls: message("urlsNotOnSite") }, values };

  const { data: id, error } = await supabase.rpc("submit_copyright_claim", {
    p_claimant_name: claim.claimantName,
    p_claimant_email: claim.claimantEmail,
    p_claimant_org: claim.claimantOrg,
    p_work_description: claim.workDescription,
    p_original_url: claim.originalUrl,
    p_infringing_urls: claim.urls,
    p_statement_good_faith: true,
    p_statement_accuracy: true,
    p_signature: claim.signature,
    p_game_id: (game.data?.id ?? null) as string,
    p_post_id: (post.data?.id ?? null) as string,
  });
  if (error || !id) {
    if (error?.message.includes("too_many_claims")) return { status: "error", message: message("tooManyClaims"), values };
    if (/claim_target_/.test(error?.message ?? "")) return { status: "error", fieldErrors: { urls: message("urlsNotOnSite") }, values };
    console.error("[claim] could not save the claim", error);
    return { status: "error", message: message("generic"), values };
  }
  return { status: "success", message: t("sent.text", { reference: id.slice(0, REFERENCE_LENGTH).toUpperCase() }) };
}
