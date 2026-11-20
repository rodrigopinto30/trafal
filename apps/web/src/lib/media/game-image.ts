import type { AvatarFormat } from "./avatar";

/**
 * Rules for the pictures of a game: one cover (a still image) and, optionally, one GIF. The browser pre-checks them for a quick
 * answer; the server never trusts that and checks again from the bytes. The stored paths are also validated by database CHECKs
 * (games_cover_path_fmt, games_gif_path_fmt).
 */
export const GAME_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const GAME_IMAGE_MIN_WIDTH = 320;
export const GAME_IMAGE_MIN_HEIGHT = 180;
export const GAME_IMAGE_MAX_SIDE = 4096;

export const GAME_IMAGE_FORMATS = {
  webp: { mime: "image/webp", ext: "webp" },
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
} as const satisfies Record<AvatarFormat, { mime: string; ext: string }>;

export function coverObjectKey(ownerId: string, token: string, format: AvatarFormat): string {
  return `covers/${ownerId}/${token}.${GAME_IMAGE_FORMATS[format].ext}`;
}

export const GAME_GIF_MAX_BYTES = 5 * 1024 * 1024;
export const GAME_GIF_MAX_SIDE = 1920;
export const GAME_GIF_MAX_FRAMES = 600;
export const GAME_GIF_MIME = "image/gif";

/** The GIF lives next to the cover, in the owner's covers folder, so deleting the account deletes it too. */
export function gifObjectKey(ownerId: string, token: string): string {
  return `covers/${ownerId}/${token}.gif`;
}
