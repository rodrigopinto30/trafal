import { z } from "zod";
import {
  CLAIM_DESCRIPTION_MAX,
  CLAIM_DESCRIPTION_MIN,
  CLAIM_EMAIL_MAX,
  CLAIM_NAME_MAX,
  CLAIM_ORG_MAX,
  CLAIM_SIGNATURE_MAX,
  CLAIM_URLS_MAX,
  CLAIM_URL_MAX,
} from "./claims-rules";
import { charLength, sanitizeLine, sanitizeMultiline } from "./text";

export * from "./claims-rules";

const line = (max: number, tooLong: string) =>
  z
    .string()
    .transform(sanitizeLine)
    .refine((value) => charLength(value) <= max, tooLong);

/** A link: absolute, http or https, short. Returns the cleaned text, or fails. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const urlLines = z
  .string()
  .transform((value) =>
    sanitizeMultiline(value)
      .split("\n")
      .map((item) => sanitizeLine(item))
      .filter((item) => item !== ""),
  )
  .pipe(
    z
      .array(z.string())
      .min(1, "urlsRequired")
      .max(CLAIM_URLS_MAX, "urlsTooMany")
      .refine((items) => items.every((item) => charLength(item) <= CLAIM_URL_MAX && isHttpUrl(item)), "urlInvalid"),
  );

export const claimFormSchema = z.object({
  claimantName: line(CLAIM_NAME_MAX, "nameTooLong").refine((value) => value !== "", "nameRequired"),
  claimantEmail: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => charLength(value) <= CLAIM_EMAIL_MAX && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), "emailInvalid"),
  claimantOrg: line(CLAIM_ORG_MAX, "orgTooLong"),
  workDescription: z
    .string()
    .transform(sanitizeMultiline)
    .refine((value) => charLength(value) >= CLAIM_DESCRIPTION_MIN, "descriptionTooShort")
    .refine((value) => charLength(value) <= CLAIM_DESCRIPTION_MAX, "descriptionTooLong"),
  originalUrl: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => value === "" || (charLength(value) <= CLAIM_URL_MAX && isHttpUrl(value)), "originalUrlInvalid"),
  urls: urlLines,
  statementGoodFaith: z.literal("on", "statementsRequired"),
  statementAccuracy: z.literal("on", "statementsRequired"),
  signature: line(CLAIM_SIGNATURE_MAX, "signatureRequired").refine((value) => value !== "", "signatureRequired"),
});

export type ClaimForm = z.infer<typeof claimFormSchema>;

/** What a link of a claim points at on the site: a game by its public id, or an update by its id. Null for anything else. */
export function parseSiteTarget(link: string, siteOrigin: string): { type: "game"; publicId: string } | { type: "post"; postId: string } | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.origin !== siteOrigin) return null;
  const game = /^\/(?:en\/)?games\/([a-z0-9-]{1,80})(?:\/|$)/.exec(url.pathname);
  if (game?.[1]) return { type: "game", publicId: game[1] };
  const post = /^\/(?:en\/)?posts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/.exec(url.pathname);
  if (post?.[1]) return { type: "post", postId: post[1] };
  return null;
}
