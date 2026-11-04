import { describe, expect, it } from "vitest";
import { CENTERED, MAX_ZOOM, MIN_ZOOM, clampCrop, coverScale, drawRect, zoomTo } from "./avatar-crop";

const VIEW = 256;

describe("coverScale", () => {
  it("cubre el cuadrado usando el lado más corto", () => {
    expect(coverScale(1000, 500, VIEW)).toBeCloseTo(0.512); // alto 500 → 256
    expect(coverScale(500, 1000, VIEW)).toBeCloseTo(0.512);
    expect(coverScale(256, 256, VIEW)).toBe(1);
    expect(coverScale(64, 64, VIEW)).toBe(4); // una imagen chica se agranda
  });
});

describe("drawRect", () => {
  it("centrada, la imagen apaisada se recorta a los costados", () => {
    const r = drawRect(CENTERED, 1000, 500, VIEW);
    expect(r.dh).toBeCloseTo(256);
    expect(r.dw).toBeCloseTo(512);
    expect(r.dx).toBeCloseTo(-128);
    expect(r.dy).toBeCloseTo(0);
  });
  it("un cuadrado a zoom 1 llena la vista justo", () => {
    expect(drawRect(CENTERED, 600, 600, VIEW)).toEqual({ dx: 0, dy: 0, dw: 256, dh: 256 });
  });
  it("el zoom agranda desde el centro", () => {
    const r = drawRect({ zoom: 2, x: 0, y: 0 }, 600, 600, VIEW);
    expect(r).toEqual({ dx: -128, dy: -128, dw: 512, dh: 512 });
  });
});

describe("clampCrop", () => {
  it("no deja que la imagen se corra y muestre un borde vacío", () => {
    // Apaisada 1000×500 a zoom 1: puede correrse como mucho 128 unidades a cada lado en X y nada en Y.
    expect(clampCrop({ zoom: 1, x: 999, y: 999 }, 1000, 500, VIEW)).toEqual({ zoom: 1, x: 128, y: 0 });
    expect(clampCrop({ zoom: 1, x: -999, y: -5 }, 1000, 500, VIEW)).toEqual({ zoom: 1, x: -128, y: 0 });
  });
  it("con más zoom hay más margen para mover", () => {
    const c = clampCrop({ zoom: 2, x: 500, y: 500 }, 600, 600, VIEW);
    expect(c).toEqual({ zoom: 2, x: 128, y: 128 });
  });
  it("acota el zoom y sanea valores raros", () => {
    expect(clampCrop({ zoom: 99, x: 0, y: 0 }, 600, 600, VIEW).zoom).toBe(MAX_ZOOM);
    expect(clampCrop({ zoom: 0.1, x: 0, y: 0 }, 600, 600, VIEW).zoom).toBe(MIN_ZOOM);
    expect(clampCrop({ zoom: Number.NaN, x: Number.NaN, y: Infinity }, 600, 600, VIEW)).toEqual({ zoom: 1, x: 0, y: 0 });
  });
  it("siempre tapa todo el cuadrado, sea cual sea el desplazamiento pedido", () => {
    for (const [w, h] of [[1000, 500], [500, 1000], [300, 300], [4000, 3000]] as const) {
      for (const zoom of [1, 1.7, 4]) {
        for (const x of [-9999, -10, 0, 10, 9999]) {
          for (const y of [-9999, 0, 9999]) {
            const r = drawRect(clampCrop({ zoom, x, y }, w, h, VIEW), w, h, VIEW);
            expect(r.dx).toBeLessThanOrEqual(0.0001);
            expect(r.dy).toBeLessThanOrEqual(0.0001);
            expect(r.dx + r.dw).toBeGreaterThanOrEqual(VIEW - 0.0001);
            expect(r.dy + r.dh).toBeGreaterThanOrEqual(VIEW - 0.0001);
          }
        }
      }
    }
  });
});

describe("zoomTo", () => {
  it("mantiene el punto central al hacer zoom", () => {
    const zoomed = zoomTo({ zoom: 2, x: 40, y: -20 }, 3, 800, 800, VIEW);
    expect(zoomed.zoom).toBe(3);
    expect(zoomed.x).toBeCloseTo(60);
    expect(zoomed.y).toBeCloseTo(-30);
  });
  it("al volver a zoom 1 la imagen vuelve a quedar centrada en lo que sobra", () => {
    expect(zoomTo({ zoom: 3, x: 100, y: 100 }, 1, 600, 600, VIEW)).toEqual({ zoom: 1, x: 0, y: 0 });
  });
});
