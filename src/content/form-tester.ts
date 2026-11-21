// Panel del probador de formularios. Se inyecta solo cuando la persona lo pide desde el popup.
// Vive dentro de un Shadow DOM para que los estilos de la página no le afecten (ni al revés).

import { analyzeForms, type FormIssue, type FormReport } from "../shared/forms";
import { detectLang, targetText } from "../shared/i18n";
import { formsText, ruleText } from "../shared/i18n-forms";
import type { Lang, Message, Severity } from "../shared/types";

const GLOBAL = "__snagkitForms__";
const COLORS = { error: "#f87171", warning: "#fbbf24" } as const;

type Api = { run: () => void };
const w = window as unknown as Record<string, Api | undefined>;

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 380px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #09090b; color: #e4e4e7;
  border: 1px solid #27272a; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,.5);
  font: 13px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif; }
header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #27272a; }
.logo { width: 20px; height: 20px; flex: none; }
h1 { margin: 0; font-size: 13px; font-weight: 600; color: #fafafa; flex: 1; }
.summary { padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 12px; display: flex; flex-wrap: wrap; gap: 4px 12px; }
.count-error { color: ${COLORS.error}; font-weight: 600; }
.count-warning { color: ${COLORS.warning}; font-weight: 600; }
.body { overflow: auto; padding: 4px 0; }
.form { padding: 8px 14px 4px; }
.form-name { font: 11px ui-monospace, Consolas, monospace; text-transform: uppercase; letter-spacing: .06em; color: #71717a; margin: 6px 0; }
.ok { color: #5eead4; font-size: 12px; margin: 2px 0 8px; }
.issue { border: 1px solid #27272a; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; background: #111114; }
.issue-head { display: flex; gap: 8px; align-items: flex-start; }
.dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: none; }
.title { color: #f4f4f5; font-weight: 500; }
.field { color: #a1a1aa; font-size: 12px; word-break: break-word; }
.help { color: #a1a1aa; font-size: 12px; margin-top: 4px; }
.actions { display: flex; gap: 6px; margin-top: 6px; }
button { font: inherit; font-size: 12px; cursor: pointer; border-radius: 6px; border: 1px solid #27272a; background: #18181b;
  color: #e4e4e7; padding: 4px 10px; }
button:hover { border-color: #5eead4; color: #5eead4; }
button:focus-visible { outline: 2px solid #5eead4; outline-offset: 2px; }
button.icon { border: none; background: none; padding: 4px 6px; color: #a1a1aa; font-size: 16px; line-height: 1; }
footer { display: flex; gap: 6px; padding: 10px 14px; border-top: 1px solid #27272a; }
footer .note { font-size: 11px; color: #71717a; margin: 0 0 0 auto; align-self: center; }
.status { padding: 24px 14px; color: #a1a1aa; text-align: center; }
.toast { color: #5eead4; font-size: 12px; align-self: center; }
`;

const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#5eead4"/><circle cx="14" cy="14" r="6.5" fill="none" stroke="#09090b" stroke-width="3"/><path d="M19 19l6 6" stroke="#09090b" stroke-width="3.2" stroke-linecap="round"/></svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function severityFor(issue: FormIssue): Severity {
  if (issue.rule === "insecure-password") return "critical";
  return issue.severity === "error" ? "medium" : "low";
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

function mount(): Api {
  const host = document.createElement("snagkit-forms");
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", { textContent: CSS }));
  const panel = el("section", { className: "panel" });
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Snagkit");
  root.append(panel);
  document.documentElement.append(host);

  const outlined = new Map<HTMLElement, { outline: string; offset: string }>();
  let reports: FormReport[] = [];
  let lang: Lang = "en";

  function outline(target: Element, color: string) {
    const h = target as HTMLElement;
    if (!h.style) return;
    if (!outlined.has(h)) outlined.set(h, { outline: h.style.outline, offset: h.style.outlineOffset });
    h.style.outline = `3px solid ${color}`;
    h.style.outlineOffset = "2px";
  }

  function clearOutlines() {
    for (const [h, prev] of outlined) {
      h.style.outline = prev.outline;
      h.style.outlineOffset = prev.offset;
    }
    outlined.clear();
  }

  function paintOutlines() {
    for (const r of reports) {
      for (const issue of r.issues) if (issue.severity === "error") outline(issue.element, COLORS.error);
      for (const issue of r.issues) if (issue.severity === "warning" && !outlined.has(issue.element as HTMLElement)) outline(issue.element, COLORS.warning);
    }
  }

  function close() {
    clearOutlines();
    host.remove();
    w[GLOBAL] = undefined;
  }

  function header() {
    const t = formsText[lang];
    const closeBtn = el("button", { className: "icon", textContent: "×", title: t.close, onclick: close });
    closeBtn.setAttribute("aria-label", t.close);
    const head = el("header", {}, el("h1", { textContent: `Snagkit · ${t.name}` }), closeBtn);
    head.insertAdjacentHTML("afterbegin", LOGO);
    return head;
  }

  function issueLines(): string {
    const t = formsText[lang];
    const lines: string[] = [`## ${t.name} — ${location.href}`, ""];
    for (const r of reports) {
      lines.push(`### ${r.name === "—" ? t.looseFields : r.name} (${t.fields(r.fields)})`);
      if (r.issues.length === 0) lines.push(`- ✅ ${t.allGood}`);
      for (const i of r.issues) {
        const text = ruleText(lang, i.rule, i.detail);
        lines.push(`- [ ] **${i.severity === "error" ? t.error : t.warning}:** ${text.title} — ${targetText(i.target, lang)}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  async function report(issue: FormIssue, form: FormReport) {
    const t = formsText[lang];
    const text = ruleText(lang, issue.rule, issue.detail);
    const field = targetText(issue.target, lang);
    issue.element.scrollIntoView({ block: "center", inline: "nearest" });
    host.style.display = "none";
    clearOutlines();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150))));
    const box = issue.element.getBoundingClientRect();
    const message: Message = {
      type: "reportFromPage",
      prefill: {
        title: `${text.title} — ${field}`,
        description: `${text.help}\n\n${t.form}: ${form.name === "—" ? t.looseFields : form.name}`,
        severity: severityFor(issue),
        steps: t.stepsFor(location.href, field, issue.rule === "accepts-invalid" ? issue.detail : undefined),
        expected: issue.rule === "accepts-invalid" ? t.expectedInvalid : undefined,
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

  function render() {
    const t = formsText[lang];
    panel.replaceChildren(header());

    if (reports.length === 0) {
      panel.append(el("p", { className: "status", textContent: t.noForms }));
      return;
    }

    const all = reports.flatMap((r) => r.issues);
    const errors = all.filter((i) => i.severity === "error").length;
    const warnings = all.length - errors;
    panel.append(
      el(
        "div",
        { className: "summary" },
        el("span", { textContent: t.forms(reports.length) }),
        el("span", { className: errors ? "count-error" : "", textContent: t.errors(errors) }),
        el("span", { className: warnings ? "count-warning" : "", textContent: t.warnings(warnings) }),
      ),
    );

    const body = el("div", { className: "body" });
    for (const r of reports) {
      const section = el(
        "div",
        { className: "form" },
        el("p", { className: "form-name", textContent: `${r.name === "—" ? t.looseFields : r.name} · ${t.fields(r.fields)}` }),
      );
      if (r.issues.length === 0) section.append(el("p", { className: "ok", textContent: `✓ ${t.allGood}` }));
      // Primero los errores, luego los avisos
      const sorted = [...r.issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
      for (const issue of sorted) {
        const text = ruleText(lang, issue.rule, issue.detail);
        const dot = el("span", { className: "dot" });
        dot.style.background = COLORS[issue.severity];
        dot.title = issue.severity === "error" ? t.error : t.warning;
        const item = el(
          "div",
          { className: "issue" },
          el(
            "div",
            { className: "issue-head" },
            dot,
            el("div", {}, el("div", { className: "title", textContent: text.title }), el("div", { className: "field", textContent: targetText(issue.target, lang) })),
          ),
          el("div", { className: "help", textContent: text.help }),
          el(
            "div",
            { className: "actions" },
            el("button", {
              textContent: t.show,
              onclick: () => {
                issue.element.scrollIntoView({ behavior: "smooth", block: "center" });
                (issue.element as HTMLElement).focus?.({ preventScroll: true });
              },
            }),
            el("button", { textContent: `🐞 ${t.report}`, onclick: () => void report(issue, r) }),
          ),
        );
        section.append(item);
      }
      body.append(section);
    }
    panel.append(body);

    const toast = el("span", { className: "toast" });
    toast.setAttribute("role", "status");
    panel.append(
      el(
        "footer",
        {},
        el("button", {
          textContent: t.copy,
          onclick: async () => {
            await navigator.clipboard.writeText(issueLines());
            toast.textContent = t.copied;
            setTimeout(() => (toast.textContent = ""), 2000);
          },
        }),
        el("button", { textContent: t.rerun, onclick: () => void run() }),
        toast,
      ),
    );
  }

  async function run() {
    lang = await loadLang();
    const t = formsText[lang];
    clearOutlines();
    panel.replaceChildren(header(), el("p", { className: "status", textContent: `${t.running} ${t.safe}` }));
    reports = await analyzeForms(document);
    paintOutlines();
    render();
  }

  void run();
  return { run: () => void run() };
}

// Si el panel ya está abierto, se vuelve a ejecutar en lugar de abrir otro.
if (w[GLOBAL]) w[GLOBAL]!.run();
else w[GLOBAL] = mount();
