import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_GRADIENTS } from "@/lib/avatar";
import { contrast, hexToRgb, luminance, mix, over, type RGB } from "./color";

/* Lee los colores REALES de globals.css: si alguien cambia un token, este test lo vuelve a validar. */
const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string): RGB {
  const match = new RegExp(`--trafal-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match) throw new Error(`No encontré --trafal-${name} en globals.css`);
  return hexToRgb(match[1] as string);
}

const bg = token("bg");
const text = token("text");
const text2 = token("text-2");
const text3 = token("text-3");
const violet = token("violet");
const cyan = token("cyan");
const lime = token("lime");
const coral = token("coral");
const panel = token("panel");
// Tarjeta: superficie al 90 % de opacidad sobre el fondo.
const card = over(token("surface"), 0.9, bg);
// Campos de formulario: blanco al 5 % sobre la superficie donde estén.
const inputOnPanel = over([255, 255, 255], 0.05, panel);
const white: RGB = [255, 255, 255];
const hex = (value: string) => hexToRgb(value);

type Pair = { name: string; fg: RGB; bg: RGB; min?: number };

const pairs: Pair[] = [
  // Texto principal y secundarios sobre cada superficie
  { name: "texto sobre fondo", fg: text, bg },
  { name: "texto sobre tarjeta", fg: text, bg: card },
  { name: "texto sobre panel", fg: text, bg: panel },
  { name: "texto secundario sobre fondo", fg: text2, bg },
  { name: "texto secundario sobre tarjeta", fg: text2, bg: card },
  { name: "texto secundario sobre panel", fg: text2, bg: panel },
  { name: "texto terciario sobre fondo", fg: text3, bg },
  { name: "texto terciario sobre tarjeta", fg: text3, bg: card },
  { name: "texto terciario sobre panel", fg: text3, bg: panel },
  { name: "placeholder de un campo", fg: text3, bg: inputOnPanel },
  { name: "texto de un campo", fg: text, bg: inputOnPanel },

  // Acentos usados como texto
  { name: "violeta sobre fondo (etiquetas pixel)", fg: violet, bg },
  { name: "violeta sobre tarjeta", fg: violet, bg: card },
  { name: "cian sobre fondo (links)", fg: cyan, bg },
  { name: "cian sobre panel", fg: cyan, bg: panel },
  { name: "lima sobre fondo (jugar)", fg: lime, bg },
  { name: "coral sobre fondo", fg: coral, bg },
  { name: "texto de error sobre panel", fg: hex("#ff8fa5"), bg: panel },
  { name: "texto de error sobre tarjeta", fg: hex("#ff8fa5"), bg: card },

  // Botones: texto oscuro (#07060e) sobre el color del botón
  { name: "botón principal, extremo violeta", fg: bg, bg: violet },
  { name: "botón principal, punto medio del degradé", fg: bg, bg: mix(violet, cyan, 0.5) },
  { name: "botón principal, extremo cian", fg: bg, bg: cyan },
  { name: "botón de jugar (lima)", fg: bg, bg: lime },
  { name: "botón destructivo (coral)", fg: bg, bg: coral },
  { name: "botón secundario (blanco)", fg: bg, bg: text },

  // Etiquetas de estado (StatusBadge): texto blanco sobre el color teñido al 12 %, 20 %, 25 % o 30 % encima de la tarjeta
  { name: "estado neutro (borrador)", fg: white, bg: over(white, 0.12, card) },
  { name: "estado violeta (revisando)", fg: white, bg: over(violet, 0.3, card) },
  { name: "estado cian (lista, publicado)", fg: white, bg: over(cyan, 0.2, card) },
  { name: "estado coral (con errores)", fg: white, bg: over(coral, 0.25, card) },

  // Etiquetas (Badge)
  { name: "badge violeta", fg: bg, bg: violet },
  { name: "badge cian", fg: cyan, bg: over(cyan, 0.12, bg) },
  { name: "badge lima (1ER JUEGO)", fg: lime, bg: over(lime, 0.12, bg) },
  { name: "badge coral", fg: hex("#ff9cb0"), bg: over(coral, 0.14, bg) },
  { name: "badge suave", fg: hex("#d3c2ff"), bg: over(violet, 0.18, bg) },
  { name: "badge contorno", fg: text2, bg },

  // Interfaz
  { name: "chip seleccionado", fg: white, bg: over(violet, 0.22, panel) },
  { name: "chip sin seleccionar", fg: text2, bg: over(white, 0.05, bg) },
  { name: "pestaña activa", fg: bg, bg: text },
  { name: "pestaña inactiva", fg: text2, bg: over(hex("#141226"), 0.8, bg) },
  { name: "mensaje de error", fg: hex("#ffb3c1"), bg: over(coral, 0.1, panel) },
  { name: "mensaje informativo", fg: cyan, bg: over(cyan, 0.1, panel) },
  { name: "link de la barra activo", fg: white, bg: hex("#090814") },
  { name: "link de la barra", fg: text2, bg: hex("#090814") },
  { name: "texto del footer", fg: text3, bg },
];

// Avatares: la inicial va en el color de fondo sobre cada color del degradé.
for (const [from, to] of AVATAR_GRADIENTS) {
  pairs.push({ name: `avatar ${from}`, fg: bg, bg: hex(from) });
  pairs.push({ name: `avatar ${to}`, fg: bg, bg: hex(to) });
}

describe("utilidades de color", () => {
  it("calcula el contraste máximo y mínimo según WCAG", () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
  });
  it("calcula la luminancia relativa", () => {
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 5);
    expect(luminance([0, 0, 0])).toBe(0);
  });
  it("compone transparencias sobre un fondo", () => {
    expect(over([255, 255, 255], 0.5, [0, 0, 0])).toEqual([128, 128, 128]);
  });
});

describe("contraste de la paleta de Trafal (WCAG AA: ≥ 4,5:1 en texto)", () => {
  it.each(pairs)("$name", ({ fg, bg: background, min = 4.5 }) => {
    const ratio = contrast(fg, background);
    expect(ratio, `contraste ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
  });

  it("documenta por qué las etiquetas violeta llevan texto oscuro: el blanco sobre violeta no llega a 4,5:1", () => {
    // La maqueta original usaba texto blanco sobre #8B5CFF (4,14:1). El requisito de accesibilidad manda.
    expect(contrast(white, violet)).toBeLessThan(4.5);
    expect(contrast(bg, violet)).toBeGreaterThanOrEqual(4.5);
  });

  it("usa exactamente los colores definidos en el brief", () => {
    expect(css).toMatch(/--trafal-bg:\s*#07060e/i);
    expect(css).toMatch(/--trafal-text:\s*#f4f2ff/i);
    expect(css).toMatch(/--trafal-text-2:\s*#cfcbe8/i);
    expect(css).toMatch(/--trafal-text-3:\s*#a9a4c7/i);
    expect(css).toMatch(/--trafal-violet:\s*#8b5cff/i);
    expect(css).toMatch(/--trafal-cyan:\s*#2ee6ff/i);
    expect(css).toMatch(/--trafal-lime:\s*#c6ff3d/i);
    expect(css).toMatch(/--trafal-coral:\s*#ff5c7a/i);
  });
});
