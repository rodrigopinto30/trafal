const u16 = (n: number) => Buffer.from([n & 255, (n >>> 8) & 255]);
const u32 = (n: number) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

/** A small valid GIF with the given number of frames. */
export function makeGif(width = 32, height = 24, frames = 2): Buffer {
  const header = Buffer.concat([Buffer.from("GIF89a"), u16(width), u16(height), Buffer.from([0x80, 0, 0]), Buffer.from([0, 0, 0, 255, 255, 255])]);
  const control = Buffer.from([0x21, 0xf9, 4, 0, 10, 0, 0, 0]);
  const frame = Buffer.concat([Buffer.from([0x2c, 0, 0, 0, 0]), u16(width), u16(height), Buffer.from([0, 2, 2, 0x44, 0x01, 0])]);
  return Buffer.concat([header, ...Array.from({ length: frames }, () => Buffer.concat([control, frame])), Buffer.from([0x3b])]);
}

const box = (type: string, ...payload: Buffer[]) => {
  const body = Buffer.concat(payload);
  return Buffer.concat([u32(8 + body.length), Buffer.from(type), body]);
};

/** A structurally valid MP4 (not playable: the server only checks the structure, the browser is not asked to play it). */
export function makeMp4(width = 640, height = 360): Buffer {
  const tkhd = box("tkhd", Buffer.from([0, 0, 0, 3]), Buffer.alloc(72), u32(width * 65536), u32(height * 65536));
  return Buffer.concat([box("ftyp", Buffer.from("isom"), u32(512), Buffer.from("isom")), box("moov", box("trak", tkhd)), box("mdat", Buffer.alloc(64))]);
}
