import { z } from "zod";
import { charLength, sanitizeMultiline } from "./text";
import { REPORT_DETAIL_MAX, REPORT_REASONS, REPORT_REASONS_BY_TARGET, REPORT_TARGETS } from "./report-rules";

export * from "./report-rules";

export const reportSchema = z
  .object({
    targetType: z.enum(REPORT_TARGETS, "generic"),
    targetId: z.uuid("generic"),
    reason: z.enum(REPORT_REASONS, "invalidReason"),
    detail: z
      .string()
      .transform(sanitizeMultiline)
      .refine((value) => charLength(value) <= REPORT_DETAIL_MAX, "detailTooLong"),
  })
  .refine((report) => REPORT_REASONS_BY_TARGET[report.targetType].includes(report.reason), { message: "invalidReason", path: ["reason"] });
