import { describe, expect, it, vi } from "vitest";
import { GAME_GIF_MAX_BYTES, GAME_GIF_MAX_SIDE, gifObjectKey } from "@/lib/media/game-image";
import { checkGameGif } from "./game-media.server";

vi.mock("@/lib/storage/s3.server", () => ({ deleteMediaObject: vi.fn() }));

const u16le = (n: number) => Uint8Array.of(n & 255, (n >>> 8) & 255);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

function gif(width: number, height: number, tail: Uint8Array = Uint8Array.of(0x3b)): Uint8Array {
  const header = concat(Uint8Array.from("GIF89a", (c) => c.charCodeAt(0)), u16le(width), u16le(height), Uint8Array.of(0x80, 0, 0), Uint8Array.of(0, 0, 0, 255, 255, 255));
  const frame = concat(Uint8Array.of(0x2c, 0, 0, 0, 0), u16le(width), u16le(height), Uint8Array.of(0, 2, 2, 0x44, 0x01, 0));
  return concat(header, frame, frame, tail);
}

const file = (bytes: Uint8Array, type = "image/gif") => new File([new Uint8Array(bytes)], "game.gif", { type });

describe("checkGameGif", () => {
  it("accepts a whole GIF within the limits", async () => {
    const bytes = gif(640, 360);
    expect(await checkGameGif(file(bytes))).toEqual(bytes);
  });

  it("rejects what is not a GIF, or says it is something else", async () => {
    expect(await checkGameGif(file(Uint8Array.of(1, 2, 3)))).toBe("invalid");
    expect(await checkGameGif(file(gif(640, 360), "image/png"))).toBe("invalid");
  });

  it("rejects a GIF with another file glued after it", async () => {
    expect(await checkGameGif(file(gif(640, 360, Uint8Array.of(0x3b, 0x50, 0x4b))))).toBe("invalid");
  });

  it("rejects one too small or too big in pixels", async () => {
    expect(await checkGameGif(file(gif(200, 100)))).toBe("dimensions");
    expect(await checkGameGif(file(gif(GAME_GIF_MAX_SIDE + 1, 360)))).toBe("dimensions");
  });

  it("rejects one too heavy before reading it", async () => {
    const heavy = new File([new Uint8Array(GAME_GIF_MAX_BYTES + 1)], "game.gif", { type: "image/gif" });
    expect(await checkGameGif(heavy)).toBe("tooLarge");
  });
});

describe("gifObjectKey", () => {
  it("puts the GIF in the owner's covers folder, the shape the database accepts", () => {
    expect(gifObjectKey("a0000000-0000-0000-0000-000000000001", "0123456789abcdef0123456789abcdef")).toBe(
      "covers/a0000000-0000-0000-0000-000000000001/0123456789abcdef0123456789abcdef.gif",
    );
  });
});
