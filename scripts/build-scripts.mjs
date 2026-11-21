import { build } from "esbuild";

// Compila el service worker y los content scripts como archivos únicos dentro de dist/.
const common = { bundle: true, target: "chrome120", logLevel: "warning" };

await Promise.all([
  build({ ...common, entryPoints: ["src/background.ts"], outfile: "dist/background.js", format: "esm" }),
  build({ ...common, entryPoints: ["src/content/page-hooks.ts"], outfile: "dist/page-hooks.js", format: "iife" }),
  build({ ...common, entryPoints: ["src/content/recorder.ts"], outfile: "dist/recorder.js", format: "iife" }),
]);
console.log("scripts ok");
