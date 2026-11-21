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
  recordingOn: "Recording",
  recordingOff: "Paused",
  start: "Start recording",
  pause: "Pause",
  pausedHint: "Press Start, then reproduce the bug. Snagkit only records while it's on, and stays on until you pause it.",
  recordingHint: "Use the page as usual. Snagkit is writing down every step.",
  modules: "Tools",
  forms: "Form tester",
  formsHint: "Checks labels, types and validation. Never submits.",
  run: "Run",
  stress: "UI stress test",
  stressHint: "Longer text, zoom, broken images, RTL. Finds what breaks.",
  tabBugs: "Bugs",
  tabForms: "Forms",
  tabStress: "Stress",
  formsLong: "Checks every form on this page. Nothing is submitted, and every field gets its original value back.",
  formsChecks: ["Missing or broken labels", "Wrong field types and missing autocomplete", "Fields that accept invalid values", "Unnamed buttons and duplicate ids"],
  runForms: "Test the forms on this page",
  stressLong: "Opens a panel on the page where you switch on tough situations one by one and see what breaks. Everything is undone when you close it.",
  stressChecks: ["Longer text, like a translation", "Text at 200% and text spacing (WCAG)", "Broken images and right-to-left layout", "Flags text that's cut off or goes off screen"],
  runStress: "Open the stress test",
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
  recordingOn: "Grabando",
  recordingOff: "En pausa",
  start: "Empezar a grabar",
  pause: "Pausar",
  pausedHint: "Pulsa Empezar y reproduce el fallo. Snagkit solo graba mientras está activo, y sigue activo hasta que lo pausas.",
  recordingHint: "Usa la página con normalidad. Snagkit va anotando cada paso.",
  modules: "Herramientas",
  forms: "Probador de formularios",
  formsHint: "Revisa etiquetas, tipos y validación. Nunca envía.",
  run: "Ejecutar",
  stress: "Test de estrés visual",
  stressHint: "Texto largo, zoom, imágenes rotas, RTL. Detecta qué se rompe.",
  tabBugs: "Bugs",
  tabForms: "Formularios",
  tabStress: "Estrés",
  formsLong: "Revisa todos los formularios de esta página. No se envía nada y cada campo recupera su valor original.",
  formsChecks: ["Etiquetas que faltan o están rotas", "Tipos de campo incorrectos y falta de autocompletado", "Campos que aceptan valores inválidos", "Botones sin nombre e ids duplicados"],
  runForms: "Probar los formularios de esta página",
  stressLong: "Abre un panel en la página donde activas situaciones difíciles una a una y ves qué se rompe. Todo se deshace al cerrarlo.",
  stressChecks: ["Texto más largo, como una traducción", "Texto al 200 % y espaciado de texto (WCAG)", "Imágenes rotas y diseño de derecha a izquierda", "Marca el texto cortado o que se sale de la pantalla"],
  runStress: "Abrir el test de estrés",
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

export function targetText(t: Target, lang: Lang): string {
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
      return es ? `Pulsar ${targetText(step.target, lang)}` : `Click ${targetText(step.target, lang)}`;
    case "type":
      return es ? `Escribir en ${targetText(step.target, lang)}` : `Type in ${targetText(step.target, lang)}`;
    case "select":
      return es
        ? `Elegir "${step.value}" en ${targetText(step.target, lang)}`
        : `Select "${step.value}" in ${targetText(step.target, lang)}`;
    case "check":
      return es
        ? `${step.checked ? "Marcar" : "Desmarcar"} ${targetText(step.target, lang)}`
        : `${step.checked ? "Check" : "Uncheck"} ${targetText(step.target, lang)}`;
    case "submit":
      return es ? `Enviar ${targetText(step.target, lang)}` : `Submit ${targetText(step.target, lang)}`;
    case "key":
      return es ? `Pulsar la tecla ${step.key} en ${targetText(step.target, lang)}` : `Press ${step.key} in ${targetText(step.target, lang)}`;
  }
}

export function stepsToText(steps: Step[], lang: Lang): string {
  return steps.map((s, i) => `${i + 1}. ${stepText(s, lang)}`).join("\n");
}

export function detectLang(): Lang {
  const ui = typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n.getUILanguage() : navigator.language;
  return ui.toLowerCase().startsWith("es") ? "es" : "en";
}
