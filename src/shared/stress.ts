// Test de estrés visual: modifica la página de forma reversible para simular situaciones
// reales (traducciones largas, zoom de texto, imágenes que no cargan…) y detecta qué se rompe.

import { describe } from "./describe";
import { snapshotStyle } from "./style-snapshot";
import type { Target } from "./types";

export type StressMode = "longText" | "bigText" | "spacing" | "brokenImages" | "rtl";
export const STRESS_MODES: StressMode[] = ["longText", "bigText", "spacing", "brokenImages", "rtl"];

export type LayoutProblemKind = "clipped" | "ellipsis" | "offscreen";
export type LayoutProblem = { kind: LayoutProblemKind; element: Element; target: Target };

// ── Pseudo-localización ─────────────────────────────────────────────────────
const ACCENTS: Record<string, string> = {
  a: "á", e: "é", i: "í", o: "ö", u: "ü", c: "ç", n: "ñ", s: "š", y: "ý", z: "ž",
  A: "Å", E: "É", I: "Í", O: "Ö", U: "Ü", C: "Ç", N: "Ñ", S: "Š", Y: "Ý", Z: "Ž",
};

/**
 * Alarga un texto un 50 % (lo que suele crecer al traducir del inglés), le pone acentos y lo
 * encierra entre ⟦ ⟧: si en pantalla no se ve el ⟧ del final, el texto se ha cortado.
 */
export function pseudoLocalize(text: string): string {
  const match = text.match(/^(\s*)(.*?)(\s*)$/s)!;
  const [, lead, core, trail] = match;
  if (!/\p{L}/u.test(core)) return text;
  const accented = [...core].map((ch) => ACCENTS[ch] ?? ch).join("");
  const extra = accented.slice(0, Math.max(2, Math.ceil(core.length * 0.5)));
  return `${lead}⟦${accented} ${extra}⟧${trail}`;
}

const SKIP_TEXT_IN = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG", "TITLE", "TEMPLATE"]);

function textNodes(root: Element): Text[] {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TEXT_IN.has(parent.tagName) || parent.closest("snagkit-forms, snagkit-stress, [contenteditable]")) return NodeFilter.FILTER_REJECT;
      return node.nodeValue && /\p{L}/u.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

// ── Modos reversibles ───────────────────────────────────────────────────────
type Undo = () => void;

const SPACING_CSS = `
*:not(snagkit-forms):not(snagkit-stress) {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-bottom: 2em !important; }`;

function applyLongText(doc: Document): Undo {
  const originals = new Map<Text, string>();
  for (const node of textNodes(doc.body)) {
    originals.set(node, node.nodeValue!);
    node.nodeValue = pseudoLocalize(node.nodeValue!);
  }
  // Botones <input type="submit"> y similares guardan su texto en value
  const inputs = new Map<HTMLInputElement, string>();
  for (const input of doc.querySelectorAll<HTMLInputElement>('input[type="submit"], input[type="button"], input[type="reset"]')) {
    inputs.set(input, input.value);
    input.value = pseudoLocalize(input.value);
  }
  return () => {
    for (const [node, value] of originals) node.nodeValue = value;
    for (const [input, value] of inputs) input.value = value;
  };
}

function applyBigText(doc: Document): Undo {
  // Se fija cada tamaño en píxeles para que el ×2 no se multiplique en elementos anidados.
  const win = doc.defaultView!;
  const restores: (() => void)[] = [];
  const elements = [...doc.body.querySelectorAll<HTMLElement>("*")].filter((el) => !el.closest("snagkit-forms, snagkit-stress"));
  const sizes = elements.map((el) => parseFloat(win.getComputedStyle(el).fontSize));
  elements.forEach((el, i) => {
    if (!sizes[i]) return;
    restores.push(snapshotStyle(el));
    el.style.setProperty("font-size", `${sizes[i] * 2}px`, "important");
  });
  return () => restores.reverse().forEach((r) => r());
}

function applySpacing(doc: Document): Undo {
  const style = doc.createElement("style");
  style.dataset.snagkit = "spacing";
  style.textContent = SPACING_CSS;
  doc.head.append(style);
  return () => style.remove();
}

function applyBrokenImages(doc: Document): Undo {
  const changed: [HTMLImageElement, string | null, string | null][] = [];
  const sources: [HTMLSourceElement, string | null][] = [];
  for (const img of doc.querySelectorAll("img")) {
    changed.push([img, img.getAttribute("src"), img.getAttribute("srcset")]);
    // Se vacían los atributos en su sitio (en vez de borrarlos) para que al restaurar el HTML quede idéntico.
    if (img.hasAttribute("srcset")) img.setAttribute("srcset", "");
    img.setAttribute("src", "data:image/png;base64,broken");
  }
  for (const source of doc.querySelectorAll("picture source")) {
    sources.push([source as HTMLSourceElement, source.getAttribute("srcset")]);
    if (source.hasAttribute("srcset")) source.setAttribute("srcset", "");
  }
  return () => {
    for (const [img, src, srcset] of changed) {
      if (srcset !== null) img.setAttribute("srcset", srcset);
      if (src !== null) img.setAttribute("src", src);
      else img.removeAttribute("src");
    }
    for (const [source, srcset] of sources) if (srcset !== null) source.setAttribute("srcset", srcset);
  };
}

function applyRtl(doc: Document): Undo {
  const html = doc.documentElement;
  const prev = html.getAttribute("dir");
  html.setAttribute("dir", "rtl");
  return () => (prev === null ? html.removeAttribute("dir") : html.setAttribute("dir", prev));
}

const APPLY: Record<StressMode, (doc: Document) => Undo> = {
  longText: applyLongText,
  bigText: applyBigText,
  spacing: applySpacing,
  brokenImages: applyBrokenImages,
  rtl: applyRtl,
};

/** Aplica los modos pedidos en un orden estable y devuelve cómo deshacerlos todos. */
export function applyModes(doc: Document, modes: Set<StressMode>): Undo {
  const undos = STRESS_MODES.filter((m) => modes.has(m)).map((m) => APPLY[m](doc));
  return () => undos.reverse().forEach((u) => u());
}

// ── Detección de problemas ──────────────────────────────────────────────────
const MAX_PROBLEMS = 60;

function hasOwnText(el: Element): boolean {
  return [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && /\p{L}/u.test(n.nodeValue ?? "")) || el instanceof HTMLInputElement;
}

/** Un elemento dentro de una zona con scroll propio (tablas anchas, carruseles) no se sale de la pantalla. */
function insideScroller(el: Element, win: Window): boolean {
  for (let p = el.parentElement; p && p !== el.ownerDocument.body; p = p.parentElement) {
    if (/auto|scroll|hidden|clip/.test(win.getComputedStyle(p).overflowX)) return true;
  }
  return false;
}

/** Busca texto recortado, puntos suspensivos que esconden texto y elementos que se salen de la pantalla. */
export function findLayoutProblems(doc: Document): LayoutProblem[] {
  const win = doc.defaultView!;
  const viewportWidth = doc.documentElement.clientWidth;
  const problems: LayoutProblem[] = [];
  const flagged = new Set<Element>();
  const add = (kind: LayoutProblemKind, el: Element) => {
    // Solo el elemento más externo: si el padre ya está marcado, el hijo sobra.
    for (let p = el.parentElement; p; p = p.parentElement) if (flagged.has(p)) return;
    flagged.add(el);
    problems.push({ kind, element: el, target: describe(el) });
  };

  for (const el of doc.body.querySelectorAll("*")) {
    if (problems.length >= MAX_PROBLEMS) break;
    if (el.closest("snagkit-forms, snagkit-stress") || SKIP_TEXT_IN.has(el.tagName)) continue;
    const style = win.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const html = el as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const clipsX = /hidden|clip/.test(style.overflowX);
    const clipsY = /hidden|clip/.test(style.overflowY);
    const overflowsX = html.scrollWidth > html.clientWidth + 1;
    const overflowsY = html.scrollHeight > html.clientHeight + 1;

    // Los carruseles y paneles grandes recortan contenido a propósito: solo cuentan cajas pequeñas o con texto propio.
    const textBox = hasOwnText(el) || rect.height < 120;
    const outside = rect.right > viewportWidth + 1 || rect.left < -1;

    if (style.textOverflow === "ellipsis" && overflowsX && hasOwnText(el)) add("ellipsis", el);
    else if (((clipsX && overflowsX) || (clipsY && overflowsY)) && textBox && el.textContent?.trim()) add("clipped", el);
    else if (outside && style.position !== "fixed" && hasOwnText(el) && !insideScroller(el, win)) add("offscreen", el);
  }
  return problems;
}
