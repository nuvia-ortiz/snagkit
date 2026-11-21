// Panel del test de estrés visual. Se inyecta solo cuando la persona lo pide desde el popup
// y deshace todos los cambios en la página al cerrarse.

import { detectLang, targetText } from "../shared/i18n";
import { stressText } from "../shared/i18n-stress";
import { createMarker } from "../shared/marks";
import { applyModes, findLayoutProblems, STRESS_MODES, type LayoutProblem, type StressMode } from "../shared/stress";
import type { Lang, Message } from "../shared/types";

const GLOBAL = "__snagkitStress__";
const RED = "#f87171";

type Api = { focus: () => void; close: () => void };
const w = window as unknown as Record<string, Api | undefined>;

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 360px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #09090b; color: #e4e4e7;
  border: 1px solid #27272a; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,.5);
  font: 13px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif; direction: ltr; text-align: left;
  letter-spacing: normal; word-spacing: normal; }
header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #27272a; }
.logo { width: 20px; height: 20px; flex: none; }
h1 { margin: 0; font-size: 13px; font-weight: 600; color: #fafafa; flex: 1; }
.intro { margin: 0; padding: 10px 14px 4px; color: #a1a1aa; font-size: 12px; }
.modes { padding: 6px 14px 10px; border-bottom: 1px solid #27272a; }
.mode { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; cursor: pointer; }
.mode input { margin: 3px 0 0; accent-color: #5eead4; width: 15px; height: 15px; flex: none; cursor: pointer; }
.mode-label { color: #f4f4f5; }
.mode-hint { color: #71717a; font-size: 11.5px; }
.summary { padding: 10px 14px 4px; font-size: 12px; color: #a1a1aa; }
.summary strong { color: ${RED}; }
.body { overflow: auto; padding: 4px 14px 8px; }
.ok { color: #5eead4; font-size: 12px; margin: 4px 0 8px; }
.problem { border: 1px solid #27272a; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; background: #111114; }
.head { display: flex; gap: 8px; align-items: baseline; }
.title { color: #f4f4f5; font-weight: 500; flex: 1; }
.tag { font: 10px ui-monospace, Consolas, monospace; text-transform: uppercase; letter-spacing: .05em; border-radius: 4px;
  padding: 1px 5px; border: 1px solid #27272a; color: #a1a1aa; flex: none; }
.tag.new { border-color: ${RED}; color: ${RED}; }
.target { color: #a1a1aa; font-size: 12px; word-break: break-word; }
.actions { display: flex; gap: 6px; margin-top: 6px; }
button { font: inherit; font-size: 12px; cursor: pointer; border-radius: 6px; border: 1px solid #27272a; background: #18181b;
  color: #e4e4e7; padding: 4px 10px; }
button:hover { border-color: #5eead4; color: #5eead4; }
button:focus-visible, .mode input:focus-visible { outline: 2px solid #5eead4; outline-offset: 2px; }
button.icon { border: none; background: none; padding: 4px 6px; color: #a1a1aa; font-size: 16px; line-height: 1; }
footer { display: flex; gap: 6px; padding: 10px 14px; border-top: 1px solid #27272a; }
`;

const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#5eead4"/><circle cx="14" cy="14" r="6.5" fill="none" stroke="#09090b" stroke-width="3"/><path d="M19 19l6 6" stroke="#09090b" stroke-width="3.2" stroke-linecap="round"/></svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

async function loadLang(): Promise<Lang> {
  try {
    const { lang } = await chrome.storage.local.get("lang");
    if (lang === "en" || lang === "es") return lang;
  } catch {
    // sin acceso al almacenamiento: idioma del navegador
  }
  return detectLang();
}

// Espera a que la página se repinte. En pestañas en segundo plano el navegador pausa
// requestAnimationFrame, así que hay un tope de tiempo para no quedarse esperando.
const nextFrame = () =>
  Promise.race([
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))),
    new Promise((r) => setTimeout(r, 400)),
  ]);

async function mount(): Promise<Api> {
  const lang = await loadLang();
  const t = stressText[lang];

  const host = document.createElement("snagkit-stress");
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { textContent: CSS }));
  const panel = el("section", { className: "panel" });
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Snagkit");
  root.append(panel);
  document.documentElement.append(host);

  const active = new Set<StressMode>();
  let undo: () => void = () => {};
  let baseline = new Set<Element>();
  let problems: LayoutProblem[] = [];
  const marker = createMarker(document, "stress");
  const clearOutlines = () => marker.clear();

  function paintOutlines() {
    for (const p of problems) marker.mark(p.element, baseline.has(p.element) ? "existing" : "new");
  }

  let pending: Promise<void> = Promise.resolve();

  /** Los cambios de modo van en fila para que dos clics rápidos no se pisen. */
  function apply() {
    pending = pending.then(async () => {
      clearOutlines();
      undo();
      undo = applyModes(document, active);
      await nextFrame();
      problems = findLayoutProblems(document);
      paintOutlines();
      renderResults();
    });
    return pending;
  }

  function close() {
    host.remove();
    w[GLOBAL] = undefined;
    void pending.then(() => {
      clearOutlines();
      undo();
    });
  }

  async function report(problem: LayoutProblem) {
    const text = t.problems[problem.kind];
    const target = targetText(problem.target, lang);
    problem.element.scrollIntoView({ block: "center", inline: "nearest" });
    host.style.display = "none";
    clearOutlines();
    await nextFrame();
    const box = problem.element.getBoundingClientRect();
    const modes = [...active].map((m) => t.modes[m].label);
    const message: Message = {
      type: "reportFromPage",
      prefill: {
        title: `${text.title} — ${target}`,
        description: `${text.help}\n\n${modes.length ? modes.join(" · ") : t.noModes}`,
        severity: baseline.has(problem.element) ? "medium" : "low",
        steps: t.stepsFor(location.href, modes, target),
        expected: t.expected,
      },
      highlight: { x: box.x, y: box.y, w: box.width, h: box.height },
    };
    try {
      await chrome.runtime.sendMessage(message);
    } finally {
      host.style.display = "";
      paintOutlines();
    }
  }

  // ── Interfaz ──
  const closeBtn = el("button", { className: "icon", textContent: "×", title: t.close, onclick: close });
  closeBtn.setAttribute("aria-label", t.close);
  const header = el("header", {}, el("h1", { textContent: `Snagkit · ${t.name}` }), closeBtn);
  header.insertAdjacentHTML("afterbegin", LOGO);

  const modes = el("div", { className: "modes" });
  for (const mode of STRESS_MODES) {
    const input = el("input", { type: "checkbox" });
    input.addEventListener("change", () => {
      if (input.checked) active.add(mode);
      else active.delete(mode);
      void apply();
    });
    modes.append(
      el(
        "label",
        { className: "mode" },
        input,
        el("span", {}, el("span", { className: "mode-label", textContent: t.modes[mode].label }), el("br"), el("span", { className: "mode-hint", textContent: t.modes[mode].hint })),
      ),
    );
  }

  const summary = el("div", { className: "summary" });
  summary.setAttribute("role", "status");
  const body = el("div", { className: "body" });
  const footer = el(
    "footer",
    {},
    el("button", {
      textContent: t.reset,
      onclick: () => {
        active.clear();
        modes.querySelectorAll("input").forEach((i) => (i.checked = false));
        void apply();
      },
    }),
  );
  panel.append(header, el("p", { className: "intro", textContent: t.intro }), modes, summary, body, footer);

  function renderResults() {
    const fresh = problems.filter((p) => !baseline.has(p.element)).length;
    summary.replaceChildren(t.found(problems.length));
    if (fresh) summary.append(" · ", el("strong", { textContent: `${fresh} ${t.isNew.toLowerCase()}` }));
    body.replaceChildren();
    if (problems.length === 0) {
      body.append(el("p", { className: "ok", textContent: `✓ ${t.none}` }));
      return;
    }
    const sorted = [...problems].sort((a, b) => Number(baseline.has(a.element)) - Number(baseline.has(b.element)));
    for (const p of sorted) {
      const isNew = !baseline.has(p.element);
      body.append(
        el(
          "div",
          { className: "problem" },
          el(
            "div",
            { className: "head" },
            el("span", { className: "title", textContent: t.problems[p.kind].title }),
            el("span", { className: `tag${isNew ? " new" : ""}`, textContent: isNew ? t.isNew : t.existing }),
          ),
          el("div", { className: "target", textContent: targetText(p.target, lang) }),
          el(
            "div",
            { className: "actions" },
            el("button", { textContent: t.show, onclick: () => p.element.scrollIntoView({ behavior: "smooth", block: "center" }) }),
            el("button", { textContent: `🐞 ${t.report}`, onclick: () => void report(p) }),
          ),
        ),
      );
    }
  }

  // Lo que ya estaba roto antes de tocar nada, para distinguirlo de lo que rompe la prueba.
  await nextFrame();
  problems = findLayoutProblems(document);
  baseline = new Set(problems.map((p) => p.element));
  paintOutlines();
  renderResults();

  return { focus: () => panel.querySelector("input")?.focus(), close };
}

if (w[GLOBAL]) w[GLOBAL]!.focus();
else {
  // Solo una herramienta a la vez: si el probador de formularios está abierto, se cierra.
  (window as unknown as Record<string, { close?: () => void } | undefined>)["__snagkitForms__"]?.close?.();
  // Se marca al momento para que dos clics seguidos no abran dos paneles.
  w[GLOBAL] = { focus: () => {}, close: () => {} };
  void mount().then((api) => (w[GLOBAL] = api));
}
