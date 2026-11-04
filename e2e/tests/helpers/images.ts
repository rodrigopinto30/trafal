import { deflateSync } from "node:zlib";

/**
 * Imágenes sintéticas para las pruebas. Se arman a mano (sin dependencias) para poder probar también archivos
 * manipulados: tamaño equivocado, datos pegados al final, PNG animado, etc.
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 255] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};

function chunk(type: string, data: Buffer): Buffer {
  return Buffer.concat([u32(data.length), Buffer.from(type, "latin1"), data, u32(crc32(Buffer.concat([Buffer.from(type, "latin1"), data])))]);
}

/** PNG válido de un color liso con una franja diagonal (para que se note el recorte y no se comprima a nada). */
export function makePng(width: number, height: number, options: { animated?: boolean; color?: [number, number, number] } = {}): Buffer {
  const [r, g, b] = options.color ?? [139, 92, 255];
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const stripe = Math.abs(x - y) < Math.max(4, width / 20);
      row[1 + x * 3] = stripe ? 46 : r;
      row[2 + x * 3] = stripe ? 230 : g;
      row[3 + x * 3] = stripe ? 255 : b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    ...(options.animated ? [chunk("acTL", Buffer.concat([u32(2), u32(0)]))] : []),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Reemplaza el archivo de una petición multipart (la que manda el navegador al llamar una Server Action) por otros bytes
 * y otro tipo MIME, para probar que el SERVIDOR no se fía de lo que dice el navegador.
 */
export function replaceFilePart(body: Buffer, contentTypeHeader: string, bytes: Buffer, mime: string): Buffer {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentTypeHeader)?.slice(1).find(Boolean);
  if (!boundary) throw new Error("la petición no es multipart");
  const marker = Buffer.from('filename="');
  const filenameAt = body.indexOf(marker);
  if (filenameAt === -1) throw new Error("la petición no lleva ningún archivo");
  const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), filenameAt);
  const next = body.indexOf(Buffer.from(`\r\n--${boundary}`), headerEnd);
  const headerStart = body.lastIndexOf(Buffer.from(`--${boundary}`), filenameAt);
  const header = body.subarray(headerStart, headerEnd).toString("latin1").replace(/Content-Type: [^\r]+/i, `Content-Type: ${mime}`);
  return Buffer.concat([body.subarray(0, headerStart), Buffer.from(header, "latin1"), Buffer.from("\r\n\r\n"), bytes, body.subarray(next)]);
}
