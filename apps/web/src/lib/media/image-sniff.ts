import type { AvatarFormat } from "./avatar";

/**
 * Inspección de imágenes SIN decodificarlas: lee las cabeceras de PNG, JPEG y WebP para saber el formato real,
 * el tamaño declarado y si es animada. El servidor la usa para no fiarse del nombre ni del tipo MIME que manda
 * el navegador (los dos se pueden falsificar).
 *
 * Es estricta a propósito:
 *   · la firma tiene que ser de uno de los tres formatos;
 *   · el archivo tiene que terminar donde termina la imagen (IEND en PNG, FFD9 en JPEG, el tamaño RIFF en WebP):
 *     se rechaza cualquier dato pegado atrás, que es la forma típica de esconder un segundo archivo;
 *   · se informa si es animada, para poder rechazarla (un GIF/WebP animado como avatar pesa y distrae en cada lista).
 * El tamaño importa por seguridad: una imagen diminuta en bytes puede declarar 16000×16000 píxeles y, al mostrarla,
 * hacer que el navegador de cada visita reserve cientos de MB para decodificarla («bomba de descompresión»).
 */

export type ImageInfo = {
  format: AvatarFormat;
  width: number;
  height: number;
  animated: boolean;
};

/** Byte en una posición; si cae fuera del archivo lanza RangeError (lo atrapa inspectImage: archivo cortado = no es imagen). */
function at(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined) throw new RangeError("fuera del archivo");
  return value;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (start + length > bytes.length) throw new RangeError("fuera del archivo");
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Devuelve la información de la imagen, o null si no es un PNG/JPEG/WebP bien formado. */
export function inspectImage(bytes: Uint8Array): ImageInfo | null {
  try {
    if (bytes.length < 12) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (at(bytes, 0) === 0x89 && ascii(bytes, 1, 3) === "PNG") return inspectPng(bytes, view);
    if (at(bytes, 0) === 0xff && at(bytes, 1) === 0xd8 && at(bytes, 2) === 0xff) return inspectJpeg(bytes, view);
    if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return inspectWebp(bytes, view);
    return null;
  } catch {
    // DataView lanza RangeError al leer fuera del archivo: un archivo cortado no es una imagen válida.
    return null;
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function inspectPng(bytes: Uint8Array, view: DataView): ImageInfo | null {
  if (!PNG_SIGNATURE.every((byte, index) => at(bytes, index) === byte)) return null;

  let width = 0;
  let height = 0;
  let animated = false;
  let seenData = false;
  let first = true;
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    const next = offset + 12 + length; // longitud (4) + tipo (4) + datos + CRC (4)
    if (next > bytes.length) return null;

    if (first) {
      if (type !== "IHDR" || length !== 13) return null;
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      first = false;
    }
    if (type === "acTL" && !seenData) animated = true; // APNG: PNG animado
    if (type === "IDAT") seenData = true;
    if (type === "IEND") {
      // Tiene que ser el final exacto del archivo.
      return seenData && next === bytes.length ? { format: "png", width, height, animated } : null;
    }
    offset = next;
  }
  return null;
}

function inspectJpeg(bytes: Uint8Array, view: DataView): ImageInfo | null {
  // Un JPEG termina con el marcador EOI (FF D9): nada pegado atrás.
  if (at(bytes, bytes.length - 2) !== 0xff || at(bytes, bytes.length - 1) !== 0xd9) return null;

  let offset = 2; // después de SOI (FF D8)
  while (offset + 4 <= bytes.length) {
    if (at(bytes, offset) !== 0xff) return null;
    const marker = at(bytes, offset + 1);
    if (marker === 0xff) {
      offset += 1; // byte de relleno antes de un marcador
      continue;
    }
    // Marcadores sin longitud: TEM y RST0–RST7.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // EOI o SOS (datos de la imagen) sin haber pasado por el encabezado de cuadro: no hay tamaño que leer.
    if (marker === 0xd9 || marker === 0xda) return null;

    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    // SOF0–SOF15, salvo DHT (C4), JPG (C8) y DAC (CC), que no describen la imagen.
    const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      return { format: "jpeg", width: view.getUint16(offset + 7), height: view.getUint16(offset + 5), animated: false };
    }
    offset += 2 + length;
  }
  return null;
}

function inspectWebp(bytes: Uint8Array, view: DataView): ImageInfo | null {
  // El tamaño RIFF cubre todo menos los primeros 8 bytes: si no coincide, hay datos de más (o de menos).
  if (view.getUint32(4, true) + 8 !== bytes.length) return null;

  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    // Lienzo: ancho-1 y alto-1 en 24 bits cada uno. El bit 1 de las banderas indica animación.
    const animated = (at(bytes, 20) & 0x02) !== 0;
    const width = at(bytes, 24) + (at(bytes, 25) << 8) + (at(bytes, 26) << 16) + 1;
    const height = at(bytes, 27) + (at(bytes, 28) << 8) + (at(bytes, 29) << 16) + 1;
    return { format: "webp", width, height, animated };
  }
  if (chunk === "VP8L") {
    if (at(bytes, 20) !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, animated: false };
  }
  if (chunk === "VP8 ") {
    // Cuadro clave (bit 0 en 0) con el código de inicio 9D 01 2A.
    if ((at(bytes, 20) & 0x01) !== 0) return null;
    if (at(bytes, 23) !== 0x9d || at(bytes, 24) !== 0x01 || at(bytes, 25) !== 0x2a) return null;
    return { format: "webp", width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff, animated: false };
  }
  return null;
}
