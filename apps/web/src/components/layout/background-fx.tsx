"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const PixelCanvas = lazy(() => import("./pixel-canvas"));

/**
 * Efectos de JS del fondo (píxeles flotantes + halo del mouse). Solo se montan con mouse real,
 * pantalla ≥ 641 px y sin prefers-reduced-motion: en celulares no se descarga ni una línea.
 */
export function BackgroundFx() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const queries = ["(min-width: 641px)", "(pointer: fine)", "(prefers-reduced-motion: no-preference)"].map((q) =>
      window.matchMedia(q),
    );
    let idle: number | undefined;
    const update = () => {
      const allow = queries.every((q) => q.matches);
      if (!allow) {
        setEnabled(false);
        return;
      }
      // Esperar a que el navegador esté libre: el fondo nunca compite con el contenido.
      const schedule = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
      idle = schedule(() => setEnabled(true)) as number;
    };
    update();
    queries.forEach((q) => q.addEventListener("change", update));
    return () => {
      queries.forEach((q) => q.removeEventListener("change", update));
      if (idle !== undefined) (window.cancelIdleCallback ?? window.clearTimeout)(idle);
    };
  }, []);

  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <PixelCanvas />
    </Suspense>
  );
}
