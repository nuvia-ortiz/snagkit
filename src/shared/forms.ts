// Probador de formularios: revisa cada formulario de la página sin enviarlo nunca.
// Las comprobaciones estáticas solo leen el DOM; las de validación escriben un valor
// inválido, observan si el formulario reacciona y restauran el valor original.

import { describe, labelOf } from "./describe";
import type { Target } from "./types";

export type FormRule =
  | "no-label"
  | "placeholder-label"
  | "wrong-type"
  | "no-autocomplete"
  | "accepts-invalid"
  | "unnamed-button"
  | "no-submit"
  | "broken-label"
  | "duplicate-id"
  | "insecure-password";

export type FormIssue = {
  rule: FormRule;
  severity: "error" | "warning";
  target: Target;
  element: Element;
  /** Dato extra para el mensaje: tipo esperado, valor probado, id repetido… */
  detail?: string;
};

export type FormReport = { name: string; element: Element; fields: number; issues: FormIssue[] };

type Kind = "email" | "tel" | "url" | "number" | "name" | "address" | "postal";

const KIND_PATTERNS: [Kind, RegExp][] = [
  ["email", /e-?mail|correo/i],
  ["tel", /phone|tel[eé]fono|\btel\b|m[oó]vil|mobile|celular/i],
  ["url", /\burl\b|website|p[aá]gina web|sitio web/i],
  ["postal", /zip|postal|postcode|c[oó]digo postal/i],
  ["address", /address|direcci[oó]n|street|calle/i],
  ["name", /(^|[^a-z])(first|last|full|given|family)?[ _-]?name|nombre|apellido/i],
  ["number", /\bage\b|\bedad\b|quantity|cantidad|amount|importe/i],
];

/** Valores que un formulario bien hecho debería rechazar. */
const INVALID_SAMPLES: Partial<Record<Kind, string>> = {
  email: "test@",
  tel: "abcdef",
  url: "not a url",
  number: "abc",
};

const AUTOCOMPLETE_KINDS = new Set<Kind>(["email", "tel", "name", "address", "postal"]);

const SKIPPED_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file", "checkbox", "radio", "range", "color"]);

function isVisible(el: Element): boolean {
  const html = el as HTMLElement;
  if (html.hidden || html.closest("[hidden], [aria-hidden='true']")) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(html);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

function hasAccessibleName(el: Element): boolean {
  if (el.getAttribute("aria-label")?.trim()) return true;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy && labelledBy.split(/\s+/).some((id) => el.ownerDocument.getElementById(id)?.textContent?.trim())) return true;
  const labels = (el as HTMLInputElement).labels;
  if (labels && [...labels].some((l) => l.textContent?.trim())) return true;
  return !!el.getAttribute("title")?.trim();
}

function fieldText(el: Element): string {
  return [el.getAttribute("name"), el.id, el.getAttribute("autocomplete"), el.getAttribute("placeholder"), labelOf(el)].filter(Boolean).join(" ");
}

export function kindOf(el: Element): Kind | null {
  const type = (el as HTMLInputElement).type?.toLowerCase();
  if (type === "email" || type === "tel" || type === "url" || type === "number") return type;
  const text = fieldText(el);
  for (const [kind, re] of KIND_PATTERNS) if (re.test(text)) return kind;
  return null;
}

function formName(form: Element, index: number): string {
  const heading = form.querySelector("h1, h2, h3, legend");
  return (
    form.getAttribute("aria-label")?.trim() ||
    form.getAttribute("name") ||
    form.id ||
    heading?.textContent?.trim().slice(0, 50) ||
    `#${index + 1}`
  );
}

/** Cuando el "formulario" es el <body> (campos sueltos), se ignora lo que ya está dentro de un <form>. */
function inScope<T extends Element>(scope: Element, selector: string): T[] {
  const all = [...scope.querySelectorAll<T>(selector)];
  return scope.tagName === "BODY" ? all.filter((el) => !el.closest("form")) : all;
}

/** Campos editables y visibles de un formulario (o de un grupo de campos sin <form>). */
function fieldsOf(form: Element): (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[] {
  return inScope<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(form, "input, select, textarea").filter(
    (el) => !(el instanceof HTMLInputElement && SKIPPED_TYPES.has(el.type)) && !el.disabled && isVisible(el),
  );
}

function staticChecks(form: Element, doc: Document): FormIssue[] {
  const issues: FormIssue[] = [];
  const add = (rule: FormRule, severity: FormIssue["severity"], element: Element, detail?: string) =>
    issues.push({ rule, severity, element, target: describe(element), detail });

  for (const field of fieldsOf(form)) {
    const kind = kindOf(field);
    if (!hasAccessibleName(field)) {
      if (field.getAttribute("placeholder")?.trim()) add("placeholder-label", "warning", field);
      else add("no-label", "error", field);
    }
    if (field instanceof HTMLInputElement && field.type === "text" && kind && ["email", "tel", "url", "number"].includes(kind)) {
      add("wrong-type", "warning", field, kind);
    }
    if (kind && AUTOCOMPLETE_KINDS.has(kind) && !field.getAttribute("autocomplete")) add("no-autocomplete", "warning", field, kind);
  }

  const buttons = inScope(form, 'button, input[type="submit"], input[type="button"], input[type="image"]').filter(isVisible);
  for (const b of buttons) {
    const name = b instanceof HTMLInputElement ? b.value || b.getAttribute("aria-label") || b.getAttribute("alt") : labelOf(b);
    if (!name?.trim()) add("unnamed-button", "error", b);
  }
  if (form instanceof HTMLFormElement && !form.querySelector('button:not([type="button"]):not([type="reset"]), input[type="submit"], input[type="image"]')) {
    add("no-submit", "warning", form);
  }

  for (const label of inScope(form, "label[for]")) {
    const id = label.getAttribute("for")!;
    if (id && !doc.getElementById(id)) add("broken-label", "error", label, id);
  }

  const seen = new Map<string, number>();
  // Solo importan los ids de campos y etiquetas: son los que rompen la relación <label for>.
  for (const el of inScope(form, "input[id], select[id], textarea[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
  for (const [id, count] of seen) {
    if (count > 1 && id) add("duplicate-id", "error", doc.getElementById(id)!, id);
  }

  const password = inScope(form, 'input[type="password"]')[0];
  const action = form instanceof HTMLFormElement ? form.getAttribute("action") : null;
  const insecurePage = doc.location?.protocol === "http:" && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(doc.location.hostname);
  if (password && (insecurePage || action?.startsWith("http:"))) add("insecure-password", "error", password);

  return issues;
}

type Probe = (field: HTMLInputElement | HTMLTextAreaElement, value: string) => Promise<boolean>;

function setNativeValue(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // Usa el setter nativo para que React, Vue y compañía detecten el cambio.
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  field.dispatchEvent(new FocusEvent("blur"));
  field.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Escribe un valor inválido y mira si el formulario lo rechaza de alguna forma:
 * validación nativa del navegador, aria-invalid, una clase de error o un mensaje nuevo.
 */
export const probeRejects: Probe = async (field, value) => {
  const original = field.value;
  const container = field.closest("form, fieldset, [role='group']") ?? field.parentElement ?? field;
  const textBefore = container.textContent ?? "";
  const classBefore = field.className;
  try {
    setNativeValue(field, value);
    await wait(250);
    if (!field.checkValidity()) return true;
    if (field.getAttribute("aria-invalid") === "true") return true;
    if (field.className !== classBefore && /error|invalid|danger/i.test(field.className)) return true;
    if ((container.textContent ?? "") !== textBefore) return true;
    // Un <input type="number"> no admite letras: el navegador deja el valor vacío.
    if (field.value === "" && value !== "") return true;
    return false;
  } finally {
    setNativeValue(field, original);
  }
};

async function validationChecks(form: Element, probe: Probe): Promise<FormIssue[]> {
  const issues: FormIssue[] = [];
  for (const field of fieldsOf(form)) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) continue;
    if (field.readOnly || (field instanceof HTMLInputElement && field.type === "password")) continue;
    const kind = kindOf(field);
    const sample = kind ? INVALID_SAMPLES[kind] : undefined;
    if (!sample) continue;
    if (!(await probe(field, sample))) {
      issues.push({ rule: "accepts-invalid", severity: "error", element: field, target: describe(field), detail: sample });
    }
  }
  return issues;
}

/** Formularios de la página. Si no hay <form>, agrupa los campos sueltos como uno solo. */
export function findForms(doc: Document): Element[] {
  const forms = [...doc.querySelectorAll("form")].filter((f) => isVisible(f) && fieldsOf(f).length > 0);
  const loose = fieldsOf(doc.body);
  return loose.length > 0 ? [...forms, doc.body] : forms;
}

export async function analyzeForms(doc: Document, options: { probe?: Probe | false } = {}): Promise<FormReport[]> {
  const probe = options.probe === undefined ? probeRejects : options.probe;
  const reports: FormReport[] = [];
  const forms = findForms(doc);
  for (const [i, form] of forms.entries()) {
    const issues = staticChecks(form, doc);
    if (probe) issues.push(...(await validationChecks(form, probe)));
    const name = form === doc.body ? "—" : formName(form, i);
    reports.push({ name, element: form, fields: fieldsOf(form).length, issues });
  }
  return reports;
}
