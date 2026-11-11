import { z } from "zod";
import type { ReauthMethod } from "@/lib/auth/reauth";
import { DELETE_SECRET_MAX } from "./account-rules";
import { sanitizeLine } from "./text";

export const ACCOUNT_ERROR_KEYS = [
  "confirmationRequired",
  "confirmationMismatch",
  "passwordRequired",
  "emailRequired",
  "wrongPassword",
  "emailMismatch",
  "rateLimited",
  "verifyFailed",
  "deleteFailed",
  "adminCannotDelete",
  "generic",
] as const;
export type AccountErrorKey = (typeof ACCOUNT_ERROR_KEYS)[number];

/**
 * What the form to delete the account sends: the @username typed to confirm and, to prove it is them, the password (or the email, for
 * an account without a password). The password is kept exactly as typed.
 */
export function deleteAccountSchemaFor(method: ReauthMethod) {
  const missing = method === "password" ? "passwordRequired" : "emailRequired";
  return z.object({
    confirmation: z
      .string()
      .transform(sanitizeLine)
      .refine((value) => value !== "", "confirmationRequired"),
    secret: z
      .string()
      .max(DELETE_SECRET_MAX, missing)
      .refine((value) => value.trim() !== "", missing),
  });
}

const FOLDER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}(\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}){0,2}\/$/;

/** What `account_files()` returns: a folder of one bucket. Anything that does not look like one is refused before touching storage. */
export const accountFilesSchema = z
  .array(z.object({ bucket: z.enum(["media", "quarantine", "games"]), prefix: z.string().regex(FOLDER) }))
  .max(10_000);

export type AccountFile = z.infer<typeof accountFilesSchema>[number];
