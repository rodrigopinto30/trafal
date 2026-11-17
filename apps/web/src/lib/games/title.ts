/** The unique index that keeps two games from sharing a name (see the unique game titles migration). */
export const TITLE_UNIQUE_INDEX = "games_title_unique";

/** Whether a database error is a refusal because another game already uses that name. */
export function isTitleTaken(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  return error?.code === "23505" && typeof error.message === "string" && error.message.includes(TITLE_UNIQUE_INDEX);
}
