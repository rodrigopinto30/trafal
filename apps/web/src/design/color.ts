/** Utilidades de color para los tests de contraste (WCAG 2.x). */

export type RGB = readonly [number, number, number];

export function hexToRgb(hex: string): RGB {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Color hexadecimal inválido: «${hex}»`);
  const value = Number.parseInt(match[1] as string, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Pinta `fg` con opacidad `alpha` (0–1) sobre `bg`: el color que realmente se ve. */
export function over(fg: RGB, alpha: number, bg: RGB): RGB {
  return [0, 1, 2].map((i) => Math.round((fg[i] as number) * alpha + (bg[i] as number) * (1 - alpha))) as unknown as RGB;
}

/** Mezcla lineal entre dos colores (t = 0 → a, t = 1 → b), p. ej. el punto medio de un degradé. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  return over(b, t, a);
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
