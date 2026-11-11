import { z } from "zod";

export const TERMS_FORM_ERROR_KEYS = ["consentRequired", "generic"] as const;
export type TermsFormErrorKey = (typeof TERMS_FORM_ERROR_KEYS)[number];

/** The box «I am of age and I accept the current terms»: nothing is recorded without it. */
export const acceptTermsSchema = z.object({
  consent: z.boolean().refine((checked) => checked, "consentRequired"),
});
