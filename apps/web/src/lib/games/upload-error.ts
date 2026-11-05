import { formatBytes } from "@/lib/format";

/** Every stable error code the validator can report. A test keeps this list equal to packages/shared/upload-rules.json. */
export const UPLOAD_ERROR_CODES = [
  "NOT_A_ZIP",
  "CORRUPT_ARCHIVE",
  "ZIP_TOO_LARGE",
  "UNCOMPRESSED_TOO_LARGE",
  "FILE_TOO_LARGE",
  "TOO_MANY_FILES",
  "UNSAFE_PATH",
  "PATH_TOO_LONG",
  "DUPLICATE_PATH",
  "PATH_CONFLICT",
  "ENCRYPTED_ENTRY",
  "UNSUPPORTED_COMPRESSION",
  "OVERLAPPING_ENTRIES",
  "SYMLINK_NOT_ALLOWED",
  "SPECIAL_FILE",
  "EXECUTABLE_FILE",
  "NESTED_ARCHIVE",
  "EXTENSION_NOT_ALLOWED",
  "NO_INDEX_HTML",
  "PROCESSING_FAILED",
] as const;
export type UploadErrorCode = (typeof UPLOAD_ERROR_CODES)[number];

const BYTE_LIMIT_CODES: readonly string[] = ["ZIP_TOO_LARGE", "UNCOMPRESSED_TOO_LARGE", "FILE_TOO_LARGE"];

export function isUploadErrorCode(code: unknown): code is UploadErrorCode {
  return typeof code === "string" && (UPLOAD_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Turns the stored error parameters (JSON written by the worker) into message parameters. Only strings and numbers are kept,
 * and size limits (in bytes) are formatted for people.
 */
export function uploadErrorParams(locale: string, code: UploadErrorCode, params: unknown): Record<string, string | number> {
  if (typeof params !== "object" || params === null || Array.isArray(params)) return {};
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "number") {
      out[key] = key === "limit" && BYTE_LIMIT_CODES.includes(code) ? formatBytes(locale, value) : value;
    } else if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}
