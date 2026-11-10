import { z } from "zod";
import { sanitizeLine } from "./text";

export const ACCOUNT_ERROR_KEYS = ["confirmationRequired", "confirmationMismatch", "deleteFailed", "adminCannotDelete", "generic"] as const;
export type AccountErrorKey = (typeof ACCOUNT_ERROR_KEYS)[number];

export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => value !== "", "confirmationRequired"),
});

const FOLDER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}(\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}){0,2}\/$/;

/** What `account_files()` returns: a folder of one bucket. Anything that does not look like one is refused before touching storage. */
export const accountFilesSchema = z
  .array(z.object({ bucket: z.enum(["media", "quarantine", "games"]), prefix: z.string().regex(FOLDER) }))
  .max(10_000);

export type AccountFile = z.infer<typeof accountFilesSchema>[number];
