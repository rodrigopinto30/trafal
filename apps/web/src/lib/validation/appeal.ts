import { z } from "zod";
import { MODERATION_NOTE_MAX } from "./admin-rules";
import { APPEAL_MESSAGE_MAX, APPEAL_OUTCOMES, APPEAL_FILTERS, APPEAL_TARGETS, type AppealFilter } from "./appeal-rules";
import { charLength, sanitizeMultiline } from "./text";

export * from "./appeal-rules";

export const submitAppealSchema = z.object({
  targetType: z.enum(APPEAL_TARGETS, "generic"),
  targetId: z.uuid("generic"),
  message: z
    .string()
    .transform(sanitizeMultiline)
    .refine((value) => value !== "", "messageRequired")
    .refine((value) => charLength(value) <= APPEAL_MESSAGE_MAX, "messageTooLong"),
});

export const resolveAppealSchema = z.object({
  appealId: z.uuid("invalidInput"),
  outcome: z.enum(APPEAL_OUTCOMES, "invalidInput"),
  note: z
    .string()
    .transform(sanitizeMultiline)
    .refine((value) => value !== "", "reasonRequired")
    .refine((value) => charLength(value) <= MODERATION_NOTE_MAX, "noteTooLong"),
});

/** The filter of the appeals queue from the address: anything else is «open». */
export function parseAppealFilter(value: unknown): AppealFilter {
  return APPEAL_FILTERS.find((candidate) => candidate === value) ?? "open";
}
