/**
 * Client-visible limits for game uploads. packages/shared/upload-rules.json and the create_game_version SQL function are
 * the source of truth; a unit test keeps these constants in sync with both.
 */
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;
export const DAILY_UPLOAD_LIMIT = 5;
export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;
export const MAX_QUESTIONS = 3;
export const MIN_QUESTION_LENGTH = 3;
export const MAX_QUESTION_LENGTH = 140;
export const MAX_SCREENSHOTS = 6;
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 160;
export const CONTROLS_MAX = 500;
export const UPLOAD_URL_TTL_SECONDS = 60 * 60;

/** True when the file name looks like a zip. A hint for the browser only: the worker validates the real content. */
export function looksLikeZip(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".zip");
}
