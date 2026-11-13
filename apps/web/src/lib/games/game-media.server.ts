import "server-only";
import { GAME_IMAGE_FORMATS, GAME_IMAGE_MAX_BYTES, GAME_IMAGE_MAX_SIDE, GAME_IMAGE_MIN_HEIGHT, GAME_IMAGE_MIN_WIDTH } from "@/lib/media/game-image";
import { inspectImage } from "@/lib/media/image-sniff";
import { deleteMediaObject } from "@/lib/storage/s3.server";
import type { GameFormErrorKey } from "@/lib/validation/game";

export type ImageProblem = "invalid" | "tooLarge" | "dimensions" | "animated";
export type CheckedImage = { bytes: Uint8Array; format: keyof typeof GAME_IMAGE_FORMATS };

export const COVER_PROBLEM_KEYS = {
  invalid: "coverInvalid",
  tooLarge: "coverTooLarge",
  dimensions: "coverDimensions",
  animated: "coverAnimated",
} as const satisfies Record<ImageProblem, GameFormErrorKey>;

/** Checks an uploaded image from its real bytes, ignoring the name and the declared type the browser sent. */
export async function checkGameImage(file: File): Promise<CheckedImage | ImageProblem> {
  if (file.size > GAME_IMAGE_MAX_BYTES) return "tooLarge";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = inspectImage(bytes);
  if (!info || GAME_IMAGE_FORMATS[info.format].mime !== file.type) return "invalid";
  if (info.animated) return "animated";
  const { width, height } = info;
  if (width < GAME_IMAGE_MIN_WIDTH || height < GAME_IMAGE_MIN_HEIGHT || width > GAME_IMAGE_MAX_SIDE || height > GAME_IMAGE_MAX_SIDE) {
    return "dimensions";
  }
  return { bytes, format: info.format };
}

/** The non-empty files a form sent under one name. */
export function filesOf(formData: FormData, name: string): File[] {
  return formData.getAll(name).filter((value): value is File => value instanceof File && value.size > 0);
}

/** Best-effort removal of stored images: one that cannot be deleted is logged and never turns a finished edit into an error. */
export async function discardObjects(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await deleteMediaObject(key);
      } catch (error) {
        console.error("[game media] could not delete an object", key, error);
      }
    }),
  );
}
