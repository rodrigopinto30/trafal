/**
 * Geometría del recorte de la foto de perfil. Todo se calcula en «unidades de vista»: un cuadrado de `view` × `view`
 * (256 para la imagen final). La vista previa del navegador muestra ese mismo cuadrado más grande o más chico, pero la
 * cuenta es la misma, así que lo que se ve es exactamente lo que se guarda.
 *
 * Modelo: la imagen se escala para CUBRIR el cuadrado (como `object-fit: cover`) y encima se aplica un zoom ≥ 1;
 * `x` e `y` desplazan la imagen respecto del centro. Nunca se deja un borde vacío: el desplazamiento se limita para que la
 * imagen siempre tape todo el cuadrado.
 */
export type Crop = { zoom: number; x: number; y: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const CENTERED: Crop = { zoom: MIN_ZOOM, x: 0, y: 0 };

/** Escala mínima para que la imagen cubra el cuadrado. */
export function coverScale(imageWidth: number, imageHeight: number, view: number): number {
  return Math.max(view / imageWidth, view / imageHeight);
}

/** Rectángulo (en unidades de vista) donde hay que dibujar la imagen. */
export function drawRect(crop: Crop, imageWidth: number, imageHeight: number, view: number) {
  const scale = coverScale(imageWidth, imageHeight, view) * crop.zoom;
  const dw = imageWidth * scale;
  const dh = imageHeight * scale;
  return { dx: (view - dw) / 2 + crop.x, dy: (view - dh) / 2 + crop.y, dw, dh };
}

/** Acota zoom y desplazamiento para que la imagen siempre cubra el cuadrado. */
export function clampCrop(crop: Crop, imageWidth: number, imageHeight: number, view: number): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(crop.zoom) ? crop.zoom : MIN_ZOOM));
  const scale = coverScale(imageWidth, imageHeight, view) * zoom;
  const maxX = Math.max(0, (imageWidth * scale - view) / 2);
  const maxY = Math.max(0, (imageHeight * scale - view) / 2);
  // «+ 0» convierte un -0 (que sale de Math.max(-0, ...)) en 0: así el resultado es siempre un número «limpio».
  const bound = (value: number, max: number) => Math.min(max, Math.max(-max, Number.isFinite(value) ? value : 0)) + 0;
  return { zoom, x: bound(crop.x, maxX), y: bound(crop.y, maxY) };
}

/** Cambia el zoom manteniendo el centro de la vista fijo sobre la imagen (el desplazamiento escala junto con el zoom). */
export function zoomTo(crop: Crop, nextZoom: number, imageWidth: number, imageHeight: number, view: number): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  const ratio = zoom / crop.zoom;
  return clampCrop({ zoom, x: crop.x * ratio, y: crop.y * ratio }, imageWidth, imageHeight, view);
}
