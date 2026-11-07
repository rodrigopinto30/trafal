import { inspectImage } from "./image-sniff";

/**
 * Rules and byte-level inspection of the files of an update (images, GIFs and short MP4 videos). The browser pre-checks them
 * for a quick answer; the server never trusts that: it reads the real format from the bytes, rejects anything that is not
 * exactly one well-formed file, and the database re-checks kind, type, size and path (post_media_* constraints).
 */
export const POST_MEDIA_MAX_FILES = 4;
export const POST_MEDIA_MAX_ALT = 200;
export const POST_MEDIA_MAX_SIDE = 4096;
export const GIF_MAX_SIDE = 1920;
export const GIF_MAX_FRAMES = 600;

export const POST_MEDIA_KINDS = {
  image: { maxBytes: 5 * 1024 * 1024 },
  gif: { maxBytes: 8 * 1024 * 1024 },
  video: { maxBytes: 20 * 1024 * 1024 },
} as const;
export type PostMediaKind = keyof typeof POST_MEDIA_KINDS;

export const POST_MEDIA_MAX_BYTES = Math.max(...Object.values(POST_MEDIA_KINDS).map((kind) => kind.maxBytes));

const FORMATS = {
  png: { kind: "image", mime: "image/png", ext: "png" },
  jpeg: { kind: "image", mime: "image/jpeg", ext: "jpg" },
  webp: { kind: "image", mime: "image/webp", ext: "webp" },
  gif: { kind: "gif", mime: "image/gif", ext: "gif" },
  mp4: { kind: "video", mime: "video/mp4", ext: "mp4" },
} as const satisfies Record<string, { kind: PostMediaKind; mime: string; ext: string }>;

export type PostMediaFormat = keyof typeof FORMATS;
export type PostMediaInfo = { format: PostMediaFormat; kind: PostMediaKind; mime: string; ext: string; width: number; height: number };
export type PostMediaProblem = "invalid" | "animated" | "dimensions" | "tooLarge" | "typeMismatch";

/** MIME types the browser may declare for a file; anything else is rejected before reading the bytes. */
export const POST_MEDIA_MIMES: readonly string[] = Object.values(FORMATS).map((format) => format.mime);

/** `posts/<post id>/<32 hex>.<ext>` — same pattern as the database CHECK. */
export function postMediaPathPattern(postId: string): RegExp {
  return new RegExp(`^posts/${postId}/[0-9a-f]{32}\\.(webp|jpg|png|gif|mp4|webm)$`);
}

export function postMediaObjectKey(postId: string, token: string, format: PostMediaFormat): string {
  return `posts/${postId}/${token}.${FORMATS[format].ext}`;
}

class OutsideFile extends RangeError {}

function at(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined) throw new OutsideFile("outside the file");
  return value;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (start < 0 || start + length > bytes.length) throw new OutsideFile("outside the file");
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function skipSubBlocks(bytes: Uint8Array, start: number): number {
  let offset = start;
  for (;;) {
    const size = at(bytes, offset);
    offset += 1;
    if (size === 0) return offset;
    offset += size;
    if (offset > bytes.length) throw new OutsideFile("outside the file");
  }
}

export type GifInfo = { width: number; height: number; frames: number };

/** Reads a GIF block by block. It has to end exactly at its trailer: bytes glued after it are a second file hiding in the first. */
export function inspectGif(bytes: Uint8Array): GifInfo | null {
  try {
    const signature = ascii(bytes, 0, 6);
    if (signature !== "GIF87a" && signature !== "GIF89a") return null;
    const view = viewOf(bytes);
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    if (width === 0 || height === 0) return null;
    const flags = at(bytes, 10);
    let offset = 13 + (flags & 0x80 ? 3 * 2 ** ((flags & 0x07) + 1) : 0);
    let frames = 0;
    for (;;) {
      const block = at(bytes, offset);
      if (block === 0x3b) return offset === bytes.length - 1 && frames > 0 ? { width, height, frames } : null;
      if (block === 0x21) {
        offset = skipSubBlocks(bytes, offset + 2);
      } else if (block === 0x2c) {
        frames += 1;
        if (frames > GIF_MAX_FRAMES) return { width, height, frames };
        const packed = at(bytes, offset + 9);
        offset += 10 + (packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0);
        offset = skipSubBlocks(bytes, offset + 1);
      } else {
        return null;
      }
    }
  } catch {
    return null;
  }
}

const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V "]);

type Mp4Box = { type: string; start: number; payload: number; end: number };

function readBoxes(bytes: Uint8Array, start: number, end: number): Mp4Box[] | null {
  const view = viewOf(bytes);
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset < end) {
    if (offset + 8 > end) return null;
    let size = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end || view.getUint32(offset + 8) !== 0) return null;
      size = view.getUint32(offset + 12);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) return null;
    boxes.push({ type, start: offset, payload: offset + header, end: offset + size });
    offset += size;
  }
  return boxes;
}

function trackSize(bytes: Uint8Array, moov: Mp4Box): { width: number; height: number } | null {
  const view = viewOf(bytes);
  for (const trak of readBoxes(bytes, moov.payload, moov.end) ?? []) {
    if (trak.type !== "trak") continue;
    for (const child of readBoxes(bytes, trak.payload, trak.end) ?? []) {
      if (child.type !== "tkhd") continue;
      const version = at(bytes, child.payload);
      const widthAt = child.payload + (version === 1 ? 88 : 76);
      if (widthAt + 8 > child.end) continue;
      const width = Math.round(view.getUint32(widthAt) / 65536);
      const height = Math.round(view.getUint32(widthAt + 4) / 65536);
      if (width > 0 && height > 0) return { width, height };
    }
  }
  return null;
}

export type Mp4Info = { width: number; height: number };

/**
 * Checks that the bytes are one well-formed MP4 and reads the size of its video track: it starts with an «ftyp» box of a
 * known brand, its top-level boxes add up to the exact length of the file (nothing glued behind), and it has both the
 * description of the movie («moov») and its data («mdat»).
 */
export function inspectMp4(bytes: Uint8Array): Mp4Info | null {
  try {
    const boxes = readBoxes(bytes, 0, bytes.length);
    if (!boxes || boxes.length < 3) return null;
    const first = boxes[0];
    if (first?.type !== "ftyp" || first.end - first.payload < 8) return null;
    if (!MP4_BRANDS.has(ascii(bytes, first.payload, 4))) return null;
    const moov = boxes.find((box) => box.type === "moov");
    if (!moov || !boxes.some((box) => box.type === "mdat")) return null;
    return trackSize(bytes, moov);
  } catch {
    return null;
  }
}

/**
 * Works out what a file really is, ignoring its name and its declared type, and applies the rules of an update's files.
 * Returns the information to store, or the reason it is not accepted.
 */
export function inspectPostMedia(bytes: Uint8Array, declaredMime: string): { ok: true; info: PostMediaInfo } | { ok: false; problem: PostMediaProblem } {
  const bad = (problem: PostMediaProblem) => ({ ok: false as const, problem });
  const good = (format: PostMediaFormat, width: number, height: number) => ({
    ok: true as const,
    info: { format, ...FORMATS[format], width, height },
  });

  const image = inspectImage(bytes);
  if (image) {
    const format: PostMediaFormat = image.format;
    if (FORMATS[format].mime !== declaredMime) return bad("typeMismatch");
    if (image.animated) return bad("animated");
    if (bytes.length > POST_MEDIA_KINDS.image.maxBytes) return bad("tooLarge");
    if (image.width < 1 || image.height < 1 || image.width > POST_MEDIA_MAX_SIDE || image.height > POST_MEDIA_MAX_SIDE) return bad("dimensions");
    return good(format, image.width, image.height);
  }

  const gif = inspectGif(bytes);
  if (gif) {
    if (declaredMime !== FORMATS.gif.mime) return bad("typeMismatch");
    if (bytes.length > POST_MEDIA_KINDS.gif.maxBytes) return bad("tooLarge");
    if (gif.width > GIF_MAX_SIDE || gif.height > GIF_MAX_SIDE || gif.frames > GIF_MAX_FRAMES) return bad("dimensions");
    return good("gif", gif.width, gif.height);
  }

  const video = inspectMp4(bytes);
  if (video) {
    if (declaredMime !== FORMATS.mp4.mime) return bad("typeMismatch");
    if (bytes.length > POST_MEDIA_KINDS.video.maxBytes) return bad("tooLarge");
    if (video.width > POST_MEDIA_MAX_SIDE || video.height > POST_MEDIA_MAX_SIDE) return bad("dimensions");
    return good("mp4", video.width, video.height);
  }

  return bad("invalid");
}

const PNG_DROPPED_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
const JPEG_DROPPED_MARKERS = new Set([0xe1, 0xed, 0xfe]);

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const view = viewOf(bytes);
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    const marker = at(bytes, offset + 1);
    if (at(bytes, offset) !== 0xff || marker === 0xda) break;
    const end = offset + 2 + view.getUint16(offset + 2);
    if (end > bytes.length) return bytes;
    if (!JPEG_DROPPED_MARKERS.has(marker)) kept.push(bytes.subarray(offset, end));
    offset = end;
  }
  kept.push(bytes.subarray(offset));
  return concatBytes(kept);
}

function stripPng(bytes: Uint8Array): Uint8Array {
  const view = viewOf(bytes);
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const end = offset + 12 + view.getUint32(offset);
    if (end > bytes.length) return bytes;
    if (!PNG_DROPPED_CHUNKS.has(ascii(bytes, offset + 4, 4))) kept.push(bytes.subarray(offset, end));
    offset = end;
  }
  return concatBytes(kept);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

/**
 * Removes the metadata a photo may carry before it is published: EXIF and XMP of a JPEG (camera, date and, above all, GPS
 * position) and the text and EXIF chunks of a PNG. The picture itself is not touched, so it is not re-encoded. If the result
 * no longer reads as the same kind of image, the original is returned untouched (the caller has already inspected it).
 */
export function stripImageMetadata(bytes: Uint8Array, format: PostMediaFormat): Uint8Array {
  try {
    const stripped = format === "jpeg" ? stripJpeg(bytes) : format === "png" ? stripPng(bytes) : bytes;
    return inspectImage(stripped)?.format === format ? stripped : bytes;
  } catch {
    return bytes;
  }
}
