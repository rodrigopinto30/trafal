import { z } from "zod";
import { MODERATION_NOTE_MAX } from "./admin-rules";
import { emailSchema } from "./auth";
import { APPEAL_FILTERS, APPEAL_MESSAGE_MAX, APPEAL_OUTCOMES, APPEAL_TARGETS, COUNTER_NOTICE_NAME_MAX, COUNTER_NOTICE_TARGETS, type AppealFilter } from "./appeal-rules";
import { charLength, sanitizeLine, sanitizeMultiline } from "./text";

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

const message = z
  .string()
  .transform(sanitizeMultiline)
  .refine((value) => value !== "", "messageRequired")
  .refine((value) => charLength(value) <= APPEAL_MESSAGE_MAX, "messageTooLong");

/** The answer of whoever published what a copyright claim got hidden: why, who they are, how to reach them, and the two statements. */
export const counterNoticeSchema = z.object({
  targetType: z.enum(COUNTER_NOTICE_TARGETS, "generic"),
  targetId: z.uuid("generic"),
  message,
  name: z
    .string()
    .transform(sanitizeLine)
    .refine((value) => value !== "" && charLength(value) <= COUNTER_NOTICE_NAME_MAX, "nameRequired"),
  email: emailSchema,
  goodFaith: z.boolean().refine((checked) => checked, "statementsRequired"),
  accuracy: z.boolean().refine((checked) => checked, "statementsRequired"),
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
