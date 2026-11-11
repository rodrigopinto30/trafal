"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localizePath } from "@/i18n/path";
import { getTranslationsFor } from "@/i18n/server";
import { removeAccountFiles } from "@/lib/account/files";
import { getAuthUser, getMyProfile } from "@/lib/auth/dal";
import { emailMatches, reauthMethodOf } from "@/lib/auth/reauth";
import { checkPassword } from "@/lib/auth/reauth.server";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_ERROR_KEYS, accountFilesSchema, deleteAccountSchemaFor, type AccountErrorKey } from "@/lib/validation/account";
import { parseLocale } from "@/lib/validation/common";
import { fieldErrorsFrom } from "@/lib/validation/text";
import { normalizeUsername } from "@/lib/username";

/**
 * Deletes the account of the person signed in, after they type their @username and prove it is them (their password, or their email if
 * the account has none): a session left open on someone else's screen is not enough to delete it. The order matters: first the list of files they
 * own (once the rows go there is no way to know), then the account itself (one transaction: all or nothing), and only then the
 * files, which cannot fail the deletion. The session ends with the account.
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

  if (method === "password") {
    const checked = user.email ? await checkPassword(user.email, parsed.data.secret) : null;
    if (!checked?.ok) {
      const reason = checked?.reason;
      const key: AccountErrorKey = reason === "invalidCredentials" ? "wrongPassword" : reason === "rateLimited" ? "rateLimited" : "verifyFailed";
      return { status: "error", fieldErrors: { secret: errors(key) }, values };
    }
  } else if (!emailMatches(parsed.data.secret, user.email)) {
    return { status: "error", fieldErrors: { secret: errors("emailMismatch") }, values };
  }

  const supabase = await createClient();
  const listed = await supabase.rpc("account_files");
  const files = accountFilesSchema.safeParse(listed.data);
  if (listed.error || !files.success) return { status: "error", message: errors("deleteFailed") };

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { status: "error", message: /admin_cannot_delete/.test(error.message) ? errors("adminCannotDelete") : errors("deleteFailed") };

  await removeAccountFiles(files.data);
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(localizePath(locale, "/account-deleted"));
}
