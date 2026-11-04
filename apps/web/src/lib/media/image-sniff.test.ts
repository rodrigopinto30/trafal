import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { AVATAR_SIZE, avatarObjectKey, avatarPathPattern } from "./avatar";
import { inspectImage } from "./image-sniff";

/* ---------------------------------------------------------------------------------------------
 * Imágenes sintéticas. El inspector solo mira estructura (no decodifica), pero los PNG se arman bien (con CRC y datos
 * comprimidos reales) para que la prueba se parezca a lo que llega de verdad.
 * ------------------------------------------------------------------------------------------- */

const u32be = (n: number) => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const u16be = (n: number) => Uint8Array.of((n >>> 8) & 255, n & 255);
const u32le = (n: number) => Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);
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

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 255] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const pngChunk = (type: string, data: Uint8Array) =>
  concat(u32be(data.length), text(type), data, u32be(crc32(concat(text(type), data))));

function png(width: number, height: number, extraBeforeData: Uint8Array[] = []): Uint8Array {
  const ihdr = concat(u32be(width), u32be(height), Uint8Array.of(8, 2, 0, 0, 0));
  const row = new Uint8Array(1 + width * 3); // filtro 0 + píxeles negros
  const raw = concat(...Array.from({ length: height }, () => row));
  return concat(
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    pngChunk("IHDR", ihdr),
    ...extraBeforeData,
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", new Uint8Array()),
  );
}

function jpeg(width: number, height: number): Uint8Array {
  const sof0 = concat(Uint8Array.of(0xff, 0xc0), u16be(17), Uint8Array.of(8), u16be(height), u16be(width), Uint8Array.of(3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1));
  const app0 = concat(Uint8Array.of(0xff, 0xe0), u16be(16), text("JFIF\0"), Uint8Array.of(1, 1, 0, 0, 1, 0, 1, 0, 0));
  const sos = concat(Uint8Array.of(0xff, 0xda), u16be(12), Uint8Array.of(3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0));
  return concat(Uint8Array.of(0xff, 0xd8), app0, sof0, sos, Uint8Array.of(0x12, 0x34, 0x56), Uint8Array.of(0xff, 0xd9));
}

function riff(chunks: Uint8Array): Uint8Array {
  return concat(text("RIFF"), u32le(4 + chunks.length), text("WEBP"), chunks);
}
const webpChunk = (fourcc: string, data: Uint8Array) => concat(text(fourcc), u32le(data.length), data, data.length % 2 ? Uint8Array.of(0) : new Uint8Array());

function webpLossy(width: number, height: number): Uint8Array {
  const frame = concat(Uint8Array.of(0x10, 0x02, 0x00), Uint8Array.of(0x9d, 0x01, 0x2a), Uint8Array.of(width & 255, (width >> 8) & 0x3f, height & 255, (height >> 8) & 0x3f), new Uint8Array(10));
  return riff(webpChunk("VP8 ", frame));
}
function webpLossless(width: number, height: number): Uint8Array {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return riff(webpChunk("VP8L", concat(Uint8Array.of(0x2f), u32le(bits >>> 0), new Uint8Array(6))));
}
function webpExtended(width: number, height: number, animated: boolean): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  const data = concat(Uint8Array.of(animated ? 0x02 : 0x10, 0, 0, 0), Uint8Array.of(w & 255, (w >> 8) & 255, (w >> 16) & 255), Uint8Array.of(h & 255, (h >> 8) & 255, (h >> 16) & 255));
  return riff(webpChunk("VP8X", data));
}

describe("inspectImage · PNG", () => {
  it("lee formato y tamaño", () => {
    expect(inspectImage(png(AVATAR_SIZE, AVATAR_SIZE))).toEqual({ format: "png", width: 256, height: 256, animated: false });
    expect(inspectImage(png(600, 400))).toMatchObject({ width: 600, height: 400 });
  });
  it("detecta un PNG animado (APNG)", () => {
    const animated = png(256, 256, [pngChunk("acTL", concat(u32be(2), u32be(0)))]);
    expect(inspectImage(animated)?.animated).toBe(true);
  });
  it("rechaza datos pegados después del final", () => {
    expect(inspectImage(concat(png(256, 256), text("<script>alert(1)</script>")))).toBeNull();
  });
  it("rechaza un archivo cortado", () => {
    const whole = png(256, 256);
    expect(inspectImage(whole.subarray(0, whole.length - 5))).toBeNull();
    expect(inspectImage(whole.subarray(0, 30))).toBeNull();
  });
  it("rechaza un PNG que no empieza con IHDR", () => {
    const bad = concat(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), pngChunk("IDAT", new Uint8Array(4)), pngChunk("IEND", new Uint8Array()));
    expect(inspectImage(bad)).toBeNull();
  });
});

describe("inspectImage · JPEG", () => {
  it("lee formato y tamaño", () => {
    expect(inspectImage(jpeg(256, 256))).toEqual({ format: "jpeg", width: 256, height: 256, animated: false });
    expect(inspectImage(jpeg(4000, 3000))).toMatchObject({ width: 4000, height: 3000 });
  });
  it("rechaza datos pegados después del EOI y archivos sin EOI", () => {
    expect(inspectImage(concat(jpeg(256, 256), text("GIF89a")))).toBeNull();
    const whole = jpeg(256, 256);
    expect(inspectImage(whole.subarray(0, whole.length - 2))).toBeNull();
  });
  it("rechaza un JPEG sin encabezado de cuadro", () => {
    expect(inspectImage(Uint8Array.of(0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0, 0, 0, 0, 0xff, 0xd9))).toBeNull();
  });
});

describe("inspectImage · WebP", () => {
  it("lee los tres tipos de WebP", () => {
    expect(inspectImage(webpLossy(256, 256))).toEqual({ format: "webp", width: 256, height: 256, animated: false });
    expect(inspectImage(webpLossless(256, 256))).toEqual({ format: "webp", width: 256, height: 256, animated: false });
    expect(inspectImage(webpExtended(256, 256, false))).toEqual({ format: "webp", width: 256, height: 256, animated: false });
  });
  it("lee tamaños que no son cuadrados ni chicos", () => {
    expect(inspectImage(webpLossy(1000, 333))).toMatchObject({ width: 1000, height: 333 });
    expect(inspectImage(webpLossless(16383, 16383))).toMatchObject({ width: 16383, height: 16383 });
  });
  it("detecta WebP animado", () => {
    expect(inspectImage(webpExtended(256, 256, true))?.animated).toBe(true);
  });
  it("rechaza datos pegados o faltantes (el tamaño RIFF no coincide)", () => {
    expect(inspectImage(concat(webpLossy(256, 256), text("<html>")))).toBeNull();
    const whole = webpLossy(256, 256);
    expect(inspectImage(whole.subarray(0, whole.length - 3))).toBeNull();
  });
  it("rechaza un cuadro lossy sin el código de inicio", () => {
    const frame = concat(Uint8Array.of(0x10, 0x02, 0x00), Uint8Array.of(0, 0, 0), new Uint8Array(14));
    expect(inspectImage(riff(webpChunk("VP8 ", frame)))).toBeNull();
  });
});

describe("inspectImage · cosas que no son una imagen aceptable", () => {
  it.each([
    ["vacío", new Uint8Array()],
    ["unos pocos bytes", Uint8Array.of(1, 2, 3)],
    ["GIF", text("GIF89a\x01\x00\x01\x00\x00\x00\x00;")],
    ["SVG", text('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>')],
    ["HTML", text("<!doctype html><script>alert(1)</script>")],
    ["ejecutable", concat(text("MZ"), new Uint8Array(64))],
    ["ceros", new Uint8Array(512)],
    ["RIFF que no es WebP", concat(text("RIFF"), u32le(4 + 8), text("WAVE"), text("fmt "), u32le(0))],
  ])("rechaza %s", (_name, bytes) => {
    expect(inspectImage(bytes)).toBeNull();
  });
});

describe("rutas de la foto", () => {
  const userId = "a0000000-0000-0000-0000-000000000001";
  const token = "0123456789abcdef0123456789abcdef";

  it("arma la clave dentro de la carpeta de la persona", () => {
    expect(avatarObjectKey(userId, token, "webp")).toBe(`avatars/${userId}/${token}.webp`);
    expect(avatarObjectKey(userId, token, "jpeg")).toBe(`avatars/${userId}/${token}.jpg`);
  });
  it("el patrón acepta solo la carpeta propia y extensiones de imagen", () => {
    const pattern = avatarPathPattern(userId);
    expect(pattern.test(avatarObjectKey(userId, token, "png"))).toBe(true);
    expect(pattern.test(`avatars/b0000000-0000-0000-0000-000000000002/${token}.webp`)).toBe(false);
    expect(pattern.test(`avatars/${userId}/../x/${token}.webp`)).toBe(false);
    expect(pattern.test(`avatars/${userId}/${token}.svg`)).toBe(false);
    expect(pattern.test(`avatars/${userId}/${token.toUpperCase()}.webp`)).toBe(false);
    expect(pattern.test(`http://evil.example/${token}.webp`)).toBe(false);
  });
});
