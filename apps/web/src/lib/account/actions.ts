"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localizePath } from "@/i18n/path";
import { getTranslationsFor } from "@/i18n/server";
import { removeAccountFiles } from "@/lib/account/files";
import { RECENT_SIGN_IN_SECONDS, getAuthUser, getMyProfile, signedInRecently } from "@/lib/auth/dal";
import { emailMatches, reauthMethodOf } from "@/lib/auth/reauth";
import { checkPassword, type PasswordCheck } from "@/lib/auth/reauth.server";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import {
  ACCOUNT_ERROR_KEYS,
  PASSWORD_CHANGE_ERROR_KEYS,
  accountFilesSchema,
  changePasswordSchema,
  deleteAccountSchemaFor,
  type AccountErrorKey,
  type PasswordChangeErrorKey,
} from "@/lib/validation/account";
import { parseLocale } from "@/lib/validation/common";
import { fieldErrorsFrom } from "@/lib/validation/text";
import { normalizeUsername } from "@/lib/username";

/**
 * Deletes the account of the person signed in, after they type their @username and prove it is them: a session left open on someone
 * else's screen is not enough. With a password, the deletion goes through a brand-new sign-in made with it; an account without a
 * password (Google or Discord) must have signed in again in the last minutes, and types its email. The database checks the same
 * (the sign-in has to be recent), so calling it directly does not skip this. The order matters: first the list of files they own
 * (once the rows go there is no way to know), then the account itself (one transaction: all or nothing), and only then the files,
 * which cannot fail the deletion. The session ends with the account.
 */
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = parseLocale(formData.get("lang"));
  const t = getTranslationsFor(locale, "settings");
  const errors = (key: AccountErrorKey) => t(`account.errors.${key}`);

  const user = await getAuthUser();
  if (!user) redirect(localizePath(locale, "/login?next=%2Fsettings%2Faccount"));

  const method = reauthMethodOf(user);
  const parsed = deleteAccountSchemaFor(method).safeParse({ confirmation: formData.get("confirmation"), secret: formData.get("secret") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error, ACCOUNT_ERROR_KEYS, errors, "generic") };
  const values = { confirmation: parsed.data.confirmation };

  const profile = await getMyProfile();
  if (!profile) return { status: "error", message: errors("generic") };
  if (normalizeUsername(parsed.data.confirmation.replace(/^@/, "")) !== profile.username) {
    return { status: "error", fieldErrors: { confirmation: errors("confirmationMismatch") }, values };
  }

  let fresh: Extract<PasswordCheck, { ok: true }> | null = null;
  if (method === "password") {
    const captchaToken = typeof formData.get("captchaToken") === "string" ? String(formData.get("captchaToken")) : undefined;
    const checked = user.email ? await checkPassword(user.email, parsed.data.secret, captchaToken || undefined) : null;
    if (!checked?.ok) {
      const reason = checked?.reason;
      const key: AccountErrorKey =
        reason === "invalidCredentials" ? "wrongPassword" : reason === "rateLimited" ? "rateLimited" : reason === "captchaFailed" ? "captchaFailed" : "verifyFailed";
      return { status: "error", fieldErrors: { secret: errors(key) }, values };
    }
    fresh = checked;
  } else if (!emailMatches(parsed.data.secret, user.email)) {
    return { status: "error", fieldErrors: { secret: errors("emailMismatch") }, values };
  } else if (!(await signedInRecently(RECENT_SIGN_IN_SECONDS))) {
    return { status: "error", message: errors("reauthRequired"), values };
  }

  const supabase = await createClient();
  const listed = await supabase.rpc("account_files");
  const files = accountFilesSchema.safeParse(listed.data);
  if (listed.error || !files.success) {
    await fresh?.end();
    return { status: "error", message: errors("deleteFailed") };
  }

  const { error } = await (fresh?.client ?? supabase).rpc("delete_my_account");
  if (error) {
    await fresh?.end();
    if (/admin_cannot_delete/.test(error.message)) return { status: "error", message: errors("adminCannotDelete") };
    if (/reauthentication_required/.test(error.message)) return { status: "error", message: errors("reauthRequired"), values };
    return { status: "error", message: errors("deleteFailed") };
  }

  await removeAccountFiles(files.data);
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(localizePath(locale, "/account-deleted"));
}

/**
 * Changes the password from Settings. It asks for the current one, so an open session is not enough to take the account. The change
 * goes through a brand-new sign-in made with it (Supabase only lets a recent sign-in change the password). Supabase then closes every
 * other session of the account, this browser's included, so the new sign-in becomes this browser's session: the person stays in
 * here, and anywhere else they have to sign in with the new password. An account that only signs in with Google or Discord has no
 * password here to change.
 */
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = parseLocale(formData.get("lang"));
  const t = getTranslationsFor(locale, "settings");
  const errors = (key: PasswordChangeErrorKey) => t(`password.errors.${key}`);

  const user = await getAuthUser();
  if (!user) redirect(localizePath(locale, "/login?next=%2Fsettings%2Faccount"));
  if (reauthMethodOf(user) !== "password" || !user.email) return { status: "error", message: errors("noPassword") };

  const parsed = changePasswordSchema.safeParse({ current: formData.get("current"), password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error, PASSWORD_CHANGE_ERROR_KEYS, errors, "generic") };

  const captchaToken = typeof formData.get("captchaToken") === "string" ? String(formData.get("captchaToken")) : undefined;
  const checked = await checkPassword(user.email, parsed.data.current, captchaToken || undefined);
  if (!checked.ok) {
    if (checked.reason === "invalidCredentials") return { status: "error", fieldErrors: { current: errors("wrongPassword") } };
    const key: PasswordChangeErrorKey = checked.reason === "rateLimited" ? "rateLimited" : checked.reason === "captchaFailed" ? "captchaFailed" : "changeFailed";
    return { status: "error", message: errors(key) };
  }

  const { error } = await checked.client.auth.updateUser({ password: parsed.data.password });
  if (error) {
    await checked.end();
    if (error.code === "same_password") return { status: "error", fieldErrors: { password: errors("samePassword") } };
    if (error.code === "weak_password") return { status: "error", fieldErrors: { password: errors("weakPassword") } };
    return { status: "error", message: errors(error.status === 429 ? "rateLimited" : "changeFailed") };
  }

  const supabase = await createClient();
  const { data } = await checked.client.auth.getSession();
  const kept = data.session ? await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }) : null;
  if (!kept || kept.error) {
    await checked.end();
    await supabase.auth.signOut({ scope: "local" });
    redirect(localizePath(locale, "/login?next=%2Fsettings%2Faccount"));
  }
  const { error: othersError } = await supabase.auth.signOut({ scope: "others" });
  if (othersError) console.error("[account] could not close the other sessions after a password change", othersError.code);
  return { status: "success", message: t("password.changed") };
}
