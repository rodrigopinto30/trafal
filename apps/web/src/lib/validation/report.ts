import { z } from "zod";
import { charLength, sanitizeMultiline } from "./text";

import { REPORT_REASONS, REPORT_DETAIL_MAX } from "./report-rules";
export { REPORT_REASONS, REPORT_DETAIL_MAX, REPORT_ERROR_KEYS } from "./report-rules";
export type { ReportReason, ReportErrorKey } from "./report-rules";

export const reportGameSchema = z.object({
  gameId: z.uuid("generic"),
  reason: z.enum(REPORT_REASONS, "invalidReason"),
  detail: z
    .string()
    .transform(sanitizeMultiline)
    .refine((value) => charLength(value) <= REPORT_DETAIL_MAX, "detailTooLong"),
});
