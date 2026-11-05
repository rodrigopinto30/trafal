import type { AvatarFormat } from "./avatar";

/**
 * Rules for the images of a game (cover and screenshots). The browser pre-checks them for a quick answer; the server never
 * trusts that and checks again with inspectImage. The stored path is also validated by a database CHECK
 * (games_cover_path_fmt, game_screenshots_path_fmt).
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

export function screenshotObjectKey(gameId: string, token: string, format: AvatarFormat): string {
  return `screenshots/${gameId}/${token}.${GAME_IMAGE_FORMATS[format].ext}`;
}
