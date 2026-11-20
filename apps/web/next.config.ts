import path from "node:path";
import type { NextConfig } from "next";

const siteIsHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

/**
 * Security headers of the SITE (games are served from another domain by their own gateway). The Content-Security-Policy is set by
 * the proxy, because it needs addresses that are only known when the server starts (lib/security/csp.ts). HSTS only on HTTPS.
 */
const securityHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(siteIsHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Cache Components + Partial Prefetching: caparazón estático instantáneo + contenido dinámico en streaming.
  cacheComponents: true,
  partialPrefetching: true,
  reactStrictMode: true,
  poweredByHeader: false,
  htmlLimitedBots: /.*/,
  // Año del copyright del footer, fijado al compilar (leer la fecha en cada render no es compatible con el caparazón estático).
  env: { NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()) },
  // Imagen de producción mínima (docker/web.Dockerfile, target "prod"). En un monorepo hay que
  // indicar la raíz para que el trazado incluya las dependencias hoisteadas.
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
  // Desarrollo: se puede abrir también por 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // El validador experimental de «navegación instantánea» de desarrollo no puede renderizar nuestro layout (que
    // lee el idioma de la ruta y la sesión) y llena de falsos positivos el log y el overlay. En modo manual solo
    // valida lo que se marque con `export const instant`. Ojo: el chequeo de «caparazón estático» del BUILD
    // (que exige <Suspense> alrededor de cookies/params) sigue activo y es el que protege de verdad.
    instantInsights: { validationLevel: "manual-warning" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // /settings no es una pantalla: lleva a la primera sección. Una regla por idioma, porque esta redirección corre antes del proxy.
  async redirects() {
    return [
      { source: "/settings", destination: "/settings/profile", permanent: false },
      { source: "/en/settings", destination: "/en/settings/profile", permanent: false },
    ];
  },
};

export default nextConfig;
