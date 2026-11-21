import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Genera los PNG del icono a partir del mismo SVG que usa la interfaz.
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#5eead4"/>
  <circle cx="14" cy="14" r="6.5" fill="none" stroke="#09090b" stroke-width="3"/>
  <path d="M19 19l6 6" stroke="#09090b" stroke-width="3.2" stroke-linecap="round"/>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg(size)}`);
  await page.locator("svg").screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: true });
}
await browser.close();
console.log("icons ok");
