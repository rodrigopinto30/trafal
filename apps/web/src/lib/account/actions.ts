"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localizePath } from "@/i18n/path";
import { getTranslationsFor } from "@/i18n/server";
import { removeAccountFiles } from "@/lib/account/files";
import { getAuthUser, getMyProfile } from "@/lib/auth/dal";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_ERROR_KEYS, accountFilesSchema, deleteAccountSchema } from "@/lib/validation/account";
import { parseLocale } from "@/lib/validation/common";
import { fieldErrorsFrom } from "@/lib/validation/text";
import { normalizeUsername } from "@/lib/username";

/**
 * Deletes the account of the person signed in, after they type their @username. The order matters: first the list of files they
 * own (once the rows go there is no way to know), then the account itself (one transaction: all or nothing), and only then the
 * files, which cannot fail the deletion. The session ends with the account.
 */
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = parseLocale(formData.get("lang"));
  const t = getTranslationsFor(locale, "settings");
  const errors = (key: (typeof ACCOUNT_ERROR_KEYS)[number]) => t(`account.errors.${key}`);

  const user = await getAuthUser();
  if (!user) redirect(localizePath(locale, "/login?next=%2Fsettings%2Faccount"));

  const parsed = deleteAccountSchema.safeParse({ confirmation: formData.get("confirmation") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error, ACCOUNT_ERROR_KEYS, errors, "generic") };

  const profile = await getMyProfile();
  if (!profile) return { status: "error", message: errors("generic") };
  if (normalizeUsername(parsed.data.confirmation.replace(/^@/, "")) !== profile.username) {
    return { status: "error", fieldErrors: { confirmation: errors("confirmationMismatch") }, values: { confirmation: parsed.data.confirmation } };
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
