import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      // `server-only` lanza error fuera del servidor de Next; en los tests es un módulo vacío.
      "server-only": path.resolve(process.cwd(), "src/test/empty.ts"),
    },
  },
});
