"use client";

import { useEffect, useRef } from "react";

type Pixel = { x: number; y: number; s: number; v: number; a: number; sw: number; c: string; o: number };

const PALETTE = ["#8b5cff", "#2ee6ff", "#ffffff", "#ffffff", "#c6ff3d"];
const BASE_COUNT = 70;

/** Píxeles que suben despacio + halo que sigue al mouse. Se pausa cuando la pestaña no se ve. */
export default function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let pixels: Pixel[] = [];
    let frame = 0;

    const spawn = (y: number): Pixel => {
      const s = [2, 2, 3, 3, 4, 6][Math.floor(Math.random() * 6)] as number;
      return {
        x: Math.random() * width,
        y,
        s,
        v: 0.12 + Math.random() * 0.35 * (s / 4),
        a: Math.random() * Math.PI * 2,
        sw: 0.2 + Math.random() * 0.5,
        c: PALETTE[Math.floor(Math.random() * PALETTE.length)] as string,
        o: 0.25 + Math.random() * 0.55,
      };
    };

    const setup = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(BASE_COUNT * 4, (BASE_COUNT * (width * height)) / (1440 * 900)));
      pixels = Array.from({ length: count }, () => spawn(Math.random() * height));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of pixels) {
        const x = Math.round(p.x + Math.sin(p.a) * 6 * p.sw);
        const y = Math.round(p.y);
        if (p.s >= 4) {
          ctx.globalAlpha = p.o * 0.18;
          ctx.fillStyle = p.c;
          ctx.fillRect(x - p.s, y - p.s, p.s * 3, p.s * 3);
        }
        ctx.globalAlpha = p.o;
        ctx.fillStyle = p.c;
        ctx.fillRect(x, y, p.s, p.s);
      }
      ctx.globalAlpha = 1;
    };

    const step = () => {
      for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i] as Pixel;
        p.y -= p.v;
        p.a += 0.01;
        if (p.y < -12) pixels[i] = spawn(height + 12);
      }
      draw();
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onMove = (event: PointerEvent) => {
      if (haloRef.current) {
        haloRef.current.style.transform = `translate(${event.clientX - 180}px, ${event.clientY - 180}px)`;
      }
    };

    setup();
    start();
    window.addEventListener("resize", setup);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      stop();
      window.removeEventListener("resize", setup);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 size-full" />
      <div
        ref={haloRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-0 size-[360px] -translate-x-[400px] -translate-y-[400px] rounded-full bg-[radial-gradient(circle,rgb(46_230_255/0.13),rgb(139_92_255/0.08)_40%,transparent_70%)] will-change-transform"
      />
    </>
  );
}
