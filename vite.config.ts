import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite construye las páginas de la extensión (popup e informe).
// El service worker y los content scripts se compilan aparte con esbuild (scripts/build-scripts.mjs),
// porque Chrome necesita que cada content script sea un único archivo sin imports.
export default defineConfig({
  root: resolve(import.meta.dirname, "src"),
  publicDir: resolve(import.meta.dirname, "public"),
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "src/popup/index.html"),
        report: resolve(import.meta.dirname, "src/report/index.html"),
      },
    },
  },
  test: {
    root: import.meta.dirname,
    include: ["tests/unit/**/*.test.ts"],
    environment: "jsdom",
  },
});
