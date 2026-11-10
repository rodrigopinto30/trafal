/** The message the database raises when a person did something too many times in a period (see the usage limits migration). */
export const USAGE_LIMIT_MESSAGE = "usage_limit_exceeded";

/** Whether a database error is a refusal because of a usage limit. */
export function isUsageLimitError(error: { message?: string | null } | null | undefined): boolean {
  return typeof error?.message === "string" && error.message.includes(USAGE_LIMIT_MESSAGE);
}
