import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inspectImage } from "./image-sniff";
import { GIF_MAX_FRAMES, GIF_MAX_SIDE, inspectGif, inspectMp4, inspectPostMedia, postMediaObjectKey, postMediaPathPattern, stripImageMetadata } from "./post-media";

const u32be = (n: number) => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const u16le = (n: number) => Uint8Array.of(n & 255, (n >>> 8) & 255);
const text = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

function png(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => concat(u32be(data.length), text(type), data, u32be(crc32(concat(text(type), data))));
  const row = new Uint8Array(1 + width * 3);
  const raw = concat(...Array.from({ length: height }, () => row));
  return concat(
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk("IHDR", concat(u32be(width), u32be(height), Uint8Array.of(8, 2, 0, 0, 0))),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  );
}

function gif(width: number, height: number, frames = 1, tail: Uint8Array = Uint8Array.of(0x3b)): Uint8Array {
  const header = concat(text("GIF89a"), u16le(width), u16le(height), Uint8Array.of(0x80, 0, 0), Uint8Array.of(0, 0, 0, 255, 255, 255));
  const control = Uint8Array.of(0x21, 0xf9, 4, 0, 10, 0, 0, 0);
  const frame = concat(Uint8Array.of(0x2c, 0, 0, 0, 0), u16le(width), u16le(height), Uint8Array.of(0, 2, 2, 0x44, 0x01, 0));
  return concat(header, ...Array.from({ length: frames }, () => concat(control, frame)), tail);
}

const box = (type: string, ...payload: Uint8Array[]) => {
  const body = concat(...payload);
  return concat(u32be(8 + body.length), text(type), body);
};

function mp4(width = 640, height = 360, options: { brand?: string; withMdat?: boolean; tail?: Uint8Array } = {}): Uint8Array {
  const tkhd = box("tkhd", Uint8Array.of(0, 0, 0, 3), new Uint8Array(72), u32be(width * 65536), u32be(height * 65536));
  const moov = box("moov", box("trak", tkhd));
  return concat(
    box("ftyp", text(options.brand ?? "isom"), u32be(512), text("isom")),
    moov,
    options.withMdat === false ? new Uint8Array() : box("mdat", new Uint8Array(32)),
    options.tail ?? new Uint8Array(),
  );
}

describe("inspectGif", () => {
  it("reads the size and counts the frames of a well-formed GIF", () => {
    expect(inspectGif(gif(120, 80, 3))).toEqual({ width: 120, height: 80, frames: 3 });
  });

  it.each([
    ["bytes glued after the trailer", gif(10, 10, 1, Uint8Array.of(0x3b, 0x50, 0x4b))],
    ["no trailer", gif(10, 10, 1, new Uint8Array())],
    ["no frames", gif(10, 10, 0)],
    ["a cut file", gif(10, 10, 2).subarray(0, 40)],
    ["a wrong signature", concat(text("GIF90a"), gif(10, 10).subarray(6))],
    ["an unknown block", gif(10, 10, 1, Uint8Array.of(0x99, 0x3b))],
    ["a zero width", gif(0, 10)],
  ])("rejects %s", (_name, bytes) => {
    expect(inspectGif(bytes)).toBeNull();
  });
});

describe("inspectMp4", () => {
  it("reads the size of the video track", () => {
    expect(inspectMp4(mp4(1280, 720))).toEqual({ width: 1280, height: 720 });
  });

  it.each([
    ["an unknown brand", mp4(640, 360, { brand: "evil" })],
    ["no media data", mp4(640, 360, { withMdat: false })],
    ["bytes glued after the last box", mp4(640, 360, { tail: Uint8Array.of(1, 2, 3) })],
    ["a box that is longer than the file", mp4().subarray(0, mp4().length - 5)],
    ["a file that does not start with ftyp", concat(box("free", new Uint8Array(8)), mp4())],
    ["no video track (zero size)", mp4(0, 0)],
    ["plain text", text("this is not a video at all, only words in a file")],
  ])("rejects %s", (_name, bytes) => {
    expect(inspectMp4(bytes)).toBeNull();
  });
});

describe("inspectPostMedia", () => {
  it("accepts each kind with its own declared type and reports what it is", () => {
    expect(inspectPostMedia(png(64, 48), "image/png")).toMatchObject({ ok: true, info: { kind: "image", mime: "image/png", ext: "png", width: 64, height: 48 } });
    expect(inspectPostMedia(gif(64, 48, 2), "image/gif")).toMatchObject({ ok: true, info: { kind: "gif", ext: "gif" } });
    expect(inspectPostMedia(mp4(640, 360), "video/mp4")).toMatchObject({ ok: true, info: { kind: "video", ext: "mp4", width: 640, height: 360 } });
  });

  it("does not trust the declared type", () => {
    expect(inspectPostMedia(png(8, 8), "image/gif")).toEqual({ ok: false, problem: "typeMismatch" });
    expect(inspectPostMedia(gif(8, 8), "video/mp4")).toEqual({ ok: false, problem: "typeMismatch" });
    expect(inspectPostMedia(mp4(), "image/png")).toEqual({ ok: false, problem: "typeMismatch" });
  });

  it("rejects what is not an image, a GIF or an MP4, whatever it is called", () => {
    for (const bytes of [text("<html><script>alert(1)</script></html>"), text("<svg xmlns='http://www.w3.org/2000/svg'/>"), Uint8Array.of(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0), new Uint8Array(0)]) {
      for (const mime of ["image/png", "image/gif", "video/mp4"]) {
        expect(inspectPostMedia(bytes, mime)).toEqual({ ok: false, problem: "invalid" });
      }
    }
  });

  it("rejects a GIF that is too wide, too long or glued to another file", () => {
    expect(inspectPostMedia(gif(GIF_MAX_SIDE + 1, 10), "image/gif")).toEqual({ ok: false, problem: "dimensions" });
    expect(inspectPostMedia(gif(10, 10, GIF_MAX_FRAMES + 1), "image/gif")).toEqual({ ok: false, problem: "dimensions" });
    expect(inspectPostMedia(concat(gif(10, 10), png(4, 4)), "image/gif")).toEqual({ ok: false, problem: "invalid" });
  });

  it("rejects a huge picture declared in a tiny file (decompression bomb)", () => {
    expect(inspectPostMedia(png(5000, 4), "image/png")).toEqual({ ok: false, problem: "dimensions" });
  });

  it("applies the size cap of each kind", () => {
    const commentBlocks = (count: number) => concat(Uint8Array.of(0x21, 0xfe), ...Array.from({ length: count }, () => concat(Uint8Array.of(255), new Uint8Array(255))), Uint8Array.of(0));
    const withComment = (count: number) => concat(gif(10, 10).subarray(0, -1), commentBlocks(count), Uint8Array.of(0x3b));
    expect(inspectPostMedia(withComment(10), "image/gif")).toMatchObject({ ok: true });
    expect(inspectPostMedia(withComment(33_000), "image/gif")).toEqual({ ok: false, problem: "tooLarge" });
    const bigVideo = concat(mp4().subarray(0, mp4().length - 40), box("mdat", new Uint8Array(21 * 1024 * 1024)));
    expect(inspectPostMedia(bigVideo, "video/mp4")).toEqual({ ok: false, problem: "tooLarge" });
  });
});

describe("post media paths", () => {
  const postId = "55555555-5555-4555-8555-555555555510";
  const token = "0123456789abcdef0123456789abcdef";

  it("builds a key inside the folder of the post that the pattern accepts", () => {
    for (const format of ["png", "jpeg", "webp", "gif", "mp4"] as const) {
      expect(postMediaPathPattern(postId).test(postMediaObjectKey(postId, token, format))).toBe(true);
    }
  });

  it("refuses another post's folder, a made-up name and an unknown extension", () => {
    const pattern = postMediaPathPattern(postId);
    expect(pattern.test(`posts/66666666-6666-4666-8666-666666666666/${token}.png`)).toBe(false);
    expect(pattern.test(`posts/${postId}/../${token}.png`)).toBe(false);
    expect(pattern.test(`posts/${postId}/photo.png`)).toBe(false);
    expect(pattern.test(`posts/${postId}/${token}.html`)).toBe(false);
    expect(pattern.test(`avatars/${postId}/${token}.png`)).toBe(false);
  });
});

const u16be = (n: number) => Uint8Array.of((n >>> 8) & 255, n & 255);
const asText = (bytes: Uint8Array) => String.fromCharCode(...bytes);

function jpegWith(...extraSegments: Uint8Array[]): Uint8Array {
  const sof0 = concat(Uint8Array.of(0xff, 0xc0), u16be(17), Uint8Array.of(8), u16be(48), u16be(64), Uint8Array.of(3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1));
  const app0 = concat(Uint8Array.of(0xff, 0xe0), u16be(16), text("JFIF\0"), Uint8Array.of(1, 1, 0, 0, 1, 0, 1, 0, 0));
  const sos = concat(Uint8Array.of(0xff, 0xda), u16be(12), Uint8Array.of(3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0));
  return concat(Uint8Array.of(0xff, 0xd8), app0, ...extraSegments, sof0, sos, Uint8Array.of(0x12, 0x34, 0x56), Uint8Array.of(0xff, 0xd9));
}

const segment = (marker: number, payload: string) => concat(Uint8Array.of(0xff, marker), u16be(2 + payload.length), text(payload));

describe("stripImageMetadata", () => {
  it("removes the EXIF, XMP and comment segments of a JPEG and keeps it a valid JPEG of the same size", () => {
    const original = jpegWith(segment(0xe1, "Exif\0\0GPSLatitude=-34.6037"), segment(0xe1, "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>"), segment(0xfe, "taken at home"));
    expect(asText(original)).toContain("GPSLatitude");
    const stripped = stripImageMetadata(original, "jpeg");
    expect(asText(stripped)).not.toContain("GPSLatitude");
    expect(asText(stripped)).not.toContain("xmpmeta");
    expect(asText(stripped)).not.toContain("taken at home");
    expect(asText(stripped)).toContain("JFIF");
    expect(inspectImage(stripped)).toMatchObject({ format: "jpeg", width: 64, height: 48 });
    expect(stripped.length).toBeLessThan(original.length);
  });

  it("leaves a JPEG without metadata exactly as it was", () => {
    const original = jpegWith();
    expect(stripImageMetadata(original, "jpeg")).toEqual(original);
  });

  it("removes the text and EXIF chunks of a PNG and keeps the picture", () => {
    const base = png(16, 16);
    const chunk = (type: string, data: string) => concat(u32be(data.length), text(type), text(data), u32be(crc32(concat(text(type), text(data)))));
    const original = concat(base.subarray(0, 33), chunk("tEXt", "Comment\0GPS here"), chunk("eXIf", "MM\0*gps"), base.subarray(33));
    expect(asText(original)).toContain("GPS here");
    const stripped = stripImageMetadata(original, "png");
    expect(asText(stripped)).not.toContain("GPS here");
    expect(asText(stripped)).not.toContain("eXIf");
    expect(inspectImage(stripped)).toMatchObject({ format: "png", width: 16, height: 16 });
  });

  it("does not touch other formats", () => {
    const original = gif(10, 10);
    expect(stripImageMetadata(original, "gif")).toBe(original);
  });

  it("returns the original when the result would not be the same image", () => {
    const broken = concat(Uint8Array.of(0xff, 0xd8), segment(0xe1, "Exif"), Uint8Array.of(1, 2, 3));
    expect(stripImageMetadata(broken, "jpeg")).toBe(broken);
  });
});
