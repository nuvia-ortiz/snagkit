import type { Lang, Severity, Step, Target } from "./types";

const en = {
  tagline: "QA toolkit",
  consoleErrors: "Console errors",
  failedRequests: "Failed requests",
  steps: "Steps",
  reportBug: "Report a bug",
  capturing: "Capturing…",
  clear: "Clear recording",
  cleared: "Recording cleared",
  unsupported: "Snagkit can't run on this page. Open a website to start.",
  reloadHint: "Reload the page so Snagkit can start recording it.",
  modules: "Tools",
  forms: "Form tester",
  stress: "UI stress test",
  soon: "Soon",
  local: "Everything stays on your computer.",

  reportTitle: "New bug report",
  screenshot: "Screenshot",
  tools: { rect: "Box", arrow: "Arrow", pen: "Pen", blur: "Hide" },
  undo: "Undo",
  clearMarks: "Clear marks",
  title: "Title",
  titlePlaceholder: "e.g. Checkout button does nothing on mobile",
  severity: "Severity",
  severities: { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as Record<Severity, string>,
  description: "What happened?",
  expected: "What did you expect?",
  stepsLabel: "Steps to reproduce",
  include: "Include",
  envShort: "Environment",
  output: "Report",
  copyMarkdown: "Copy Markdown",
  copyJira: "Copy for Jira",
  copyImage: "Copy image",
  downloadImage: "Download image",
  downloadMd: "Download .md",
  openGithub: "Open GitHub issue",
  githubRepo: "GitHub repository (owner/repo)",
  copied: "Copied",
  githubHint: "The issue opens with the text filled in. Paste the image with Ctrl+V.",
  tooLong: "The report was too long for a link, so it was shortened. Use Copy Markdown for the full version.",
  notFound: "This report is no longer available. Create a new one from the Snagkit button.",
  noData: "Nothing recorded",

  md: {
    severity: "Severity",
    description: "Description",
    expected: "Expected result",
    steps: "Steps to reproduce",
    screenshot: "Screenshot",
    screenshotNote: "_Paste the screenshot here._",
    env: "Environment",
    url: "URL",
    browser: "Browser",
    os: "OS",
    viewport: "Viewport",
    screen: "Screen",
    language: "Language",
    time: "Time",
    console: "Console errors",
    network: "Failed requests",
    footer: "Report generated with Snagkit",
    untitled: "Untitled bug",
  },
};

type Dict = typeof en;

const es: Dict = {
  tagline: "Kit de QA",
  consoleErrors: "Errores de consola",
  failedRequests: "Peticiones fallidas",
  steps: "Pasos",
  reportBug: "Reportar un bug",
  capturing: "Capturando…",
  clear: "Borrar grabación",
  cleared: "Grabación borrada",
  unsupported: "Snagkit no puede funcionar en esta página. Abre una web para empezar.",
  reloadHint: "Recarga la página para que Snagkit empiece a grabarla.",
  modules: "Herramientas",
  forms: "Probador de formularios",
  stress: "Test de estrés visual",
  soon: "Pronto",
  local: "Todo se queda en tu ordenador.",

  reportTitle: "Nuevo reporte de bug",
  screenshot: "Captura",
  tools: { rect: "Recuadro", arrow: "Flecha", pen: "Lápiz", blur: "Ocultar" },
  undo: "Deshacer",
  clearMarks: "Quitar marcas",
  title: "Título",
  titlePlaceholder: "p. ej. El botón de pagar no hace nada en móvil",
  severity: "Gravedad",
  severities: { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja" },
  description: "¿Qué ha pasado?",
  expected: "¿Qué esperabas que pasara?",
  stepsLabel: "Pasos para reproducirlo",
  include: "Incluir",
  envShort: "Entorno",
  output: "Reporte",
  copyMarkdown: "Copiar Markdown",
  copyJira: "Copiar para Jira",
  copyImage: "Copiar imagen",
  downloadImage: "Descargar imagen",
  downloadMd: "Descargar .md",
  openGithub: "Abrir issue en GitHub",
  githubRepo: "Repositorio de GitHub (usuario/repo)",
  copied: "Copiado",
  githubHint: "La issue se abre con el texto relleno. Pega la imagen con Ctrl+V.",
  tooLong: "El reporte era demasiado largo para un enlace y se ha recortado. Usa Copiar Markdown para la versión completa.",
  notFound: "Este reporte ya no está disponible. Crea uno nuevo desde el botón de Snagkit.",
  noData: "Nada registrado",

  md: {
    severity: "Gravedad",
    description: "Descripción",
    expected: "Resultado esperado",
    steps: "Pasos para reproducirlo",
    screenshot: "Captura",
    screenshotNote: "_Pega aquí la captura._",
    env: "Entorno",
    url: "URL",
    browser: "Navegador",
    os: "Sistema",
    viewport: "Ventana",
    screen: "Pantalla",
    language: "Idioma",
    time: "Fecha",
    console: "Errores de consola",
    network: "Peticiones fallidas",
    footer: "Reporte generado con Snagkit",
    untitled: "Bug sin título",
  },
};

export const dictionaries: Record<Lang, Dict> = { en, es };

const ROLE_NAMES: Record<Lang, Record<string, string>> = {
  en: { field: "field", button: "button", link: "link", dropdown: "dropdown", checkbox: "checkbox", radio: "option", image: "image", label: "label", heading: "heading", form: "form" },
  es: { field: "campo", button: "botón", link: "enlace", dropdown: "desplegable", checkbox: "casilla", radio: "opción", image: "imagen", label: "etiqueta", heading: "título", form: "formulario" },
};

function target(t: Target, lang: Lang): string {
  const role = ROLE_NAMES[lang][t.role] ?? t.role;
  return t.label ? `${role} "${t.label}"` : role;
}

/** Convierte un paso grabado en una frase legible. */
export function stepText(step: Step, lang: Lang): string {
  const es = lang === "es";
  switch (step.kind) {
    case "navigate":
      return es ? `Abrir ${step.url}` : `Open ${step.url}`;
    case "click":
      return es ? `Pulsar ${target(step.target, lang)}` : `Click ${target(step.target, lang)}`;
    case "type":
      return es ? `Escribir en ${target(step.target, lang)}` : `Type in ${target(step.target, lang)}`;
    case "select":
      return es
        ? `Elegir "${step.value}" en ${target(step.target, lang)}`
        : `Select "${step.value}" in ${target(step.target, lang)}`;
    case "check":
      return es
        ? `${step.checked ? "Marcar" : "Desmarcar"} ${target(step.target, lang)}`
        : `${step.checked ? "Check" : "Uncheck"} ${target(step.target, lang)}`;
    case "submit":
      return es ? `Enviar ${target(step.target, lang)}` : `Submit ${target(step.target, lang)}`;
    case "key":
      return es ? `Pulsar la tecla ${step.key} en ${target(step.target, lang)}` : `Press ${step.key} in ${target(step.target, lang)}`;
  }
}

export function stepsToText(steps: Step[], lang: Lang): string {
  return steps.map((s, i) => `${i + 1}. ${stepText(s, lang)}`).join("\n");
}

export function detectLang(): Lang {
  const ui = typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n.getUILanguage() : navigator.language;
  return ui.toLowerCase().startsWith("es") ? "es" : "en";
}
