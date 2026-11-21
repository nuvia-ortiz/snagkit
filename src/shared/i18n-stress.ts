import type { LayoutProblemKind, StressMode } from "./stress";
import type { Lang } from "./types";

type StressDict = {
  name: string;
  intro: string;
  modes: Record<StressMode, { label: string; hint: string }>;
  problems: Record<LayoutProblemKind, { title: string; help: string }>;
  found: (n: number) => string;
  none: string;
  isNew: string;
  existing: string;
  show: string;
  report: string;
  reset: string;
  close: string;
  stepsFor: (url: string, modes: string[], target: string) => string;
  expected: string;
  noModes: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const stressText: Record<Lang, StressDict> = {
  en: {
    name: "UI stress test",
    intro: "Turn on a situation to see how the page copes. Everything goes back to normal when you close this panel.",
    modes: {
      longText: { label: "Longer text (+50%)", hint: "Like a translation. If you can't see the closing ⟧, the text is cut off." },
      bigText: { label: "Text at 200%", hint: "Text zoom for low vision (WCAG 1.4.4)." },
      spacing: { label: "Text spacing", hint: "Line, letter, word and paragraph spacing (WCAG 1.4.12)." },
      brokenImages: { label: "Broken images", hint: "What people see when images fail to load." },
      rtl: { label: "Right to left", hint: "Layout for Arabic or Hebrew." },
    },
    problems: {
      clipped: { title: "Text cut off", help: "The content is larger than its box and the box hides the rest." },
      ellipsis: { title: "Text hidden behind “…”", help: "The text is truncated with an ellipsis, so part of it can't be read." },
      offscreen: { title: "Goes off screen", help: "The element sticks out of the window and forces horizontal scrolling." },
    },
    found: (n) => plural(n, "problem", "problems"),
    none: "No layout problems detected.",
    isNew: "New",
    existing: "Already there",
    show: "Show",
    report: "Report",
    reset: "Reset",
    close: "Close",
    stepsFor: (url, modes, target) =>
      [`1. Open ${url}`, ...modes.map((m, i) => `${i + 2}. Apply: ${m}`), `${modes.length + 2}. Look at ${target}`].join("\n"),
    expected: "The text wraps or the element grows. Nothing is cut off and nothing goes off screen.",
    noModes: "no changes (default page)",
  },
  es: {
    name: "Test de estrés visual",
    intro: "Activa una situación para ver cómo responde la página. Todo vuelve a la normalidad al cerrar este panel.",
    modes: {
      longText: { label: "Texto más largo (+50 %)", hint: "Como una traducción. Si no ves el ⟧ del final, el texto está cortado." },
      bigText: { label: "Texto al 200 %", hint: "Zoom de texto para baja visión (WCAG 1.4.4)." },
      spacing: { label: "Espaciado de texto", hint: "Interlineado y espacio entre letras, palabras y párrafos (WCAG 1.4.12)." },
      brokenImages: { label: "Imágenes rotas", hint: "Lo que se ve cuando las imágenes no cargan." },
      rtl: { label: "Derecha a izquierda", hint: "Diseño para árabe o hebreo." },
    },
    problems: {
      clipped: { title: "Texto cortado", help: "El contenido es más grande que su caja y la caja esconde el resto." },
      ellipsis: { title: "Texto escondido tras «…»", help: "El texto se recorta con puntos suspensivos y una parte no se puede leer." },
      offscreen: { title: "Se sale de la pantalla", help: "El elemento sobresale de la ventana y obliga a hacer scroll horizontal." },
    },
    found: (n) => plural(n, "problema", "problemas"),
    none: "No se han detectado problemas de diseño.",
    isNew: "Nuevo",
    existing: "Ya estaba",
    show: "Ver",
    report: "Reportar",
    reset: "Restablecer",
    close: "Cerrar",
    stepsFor: (url, modes, target) =>
      [`1. Abrir ${url}`, ...modes.map((m, i) => `${i + 2}. Aplicar: ${m}`), `${modes.length + 2}. Mirar ${target}`].join("\n"),
    expected: "El texto pasa a la línea siguiente o el elemento crece. Nada se corta y nada se sale de la pantalla.",
    noModes: "sin cambios (página tal cual)",
  },
};
