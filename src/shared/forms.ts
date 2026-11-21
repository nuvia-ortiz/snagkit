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
  | "autocomplete-off"
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

/**
 * Valor de autocomplete recomendado según lo que pide el campo (tokens del estándar HTML).
 * Devuelve null cuando no existe un token adecuado, como el segundo apellido.
 */
export function suggestedAutocomplete(el: Element, kind: Kind | null): string | null {
  const text = fieldText(el);
  switch (kind) {
    case "email":
      return "email";
    case "tel":
      return "tel";
    case "postal":
      return "postal-code";
    case "address":
      return "street-address";
    case "name":
      if (/(2|segund|second)\S*\s*apellido|second(ary)?[ _-]?(last|family)/i.test(text)) return null;
      if (/apellido|last|family|surname/i.test(text)) return "family-name";
      if (/first|given|^nombre$|nombre(?!.*apellido)/i.test(text) && !/full|complet/i.test(text)) return "given-name";
      return "name";
    default:
      return null;
  }
}

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
  // "Usuario o email" admite cosas que no son un email: no se puede exigir formato de email.
  if (/user|usuario|login|nick/i.test(text) && /e-?mail|correo/i.test(text)) return null;
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
    const suggestion = suggestedAutocomplete(field, kind);
    const autocomplete = field.getAttribute("autocomplete")?.trim().toLowerCase();
    if (suggestion && !autocomplete) add("no-autocomplete", "warning", field, suggestion);
    else if (suggestion && autocomplete && /^(off|false|no|nope|none|disabled?)$/.test(autocomplete)) add("autocomplete-off", "warning", field, suggestion);
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

const ERROR_CLASS = /error|invalid|danger/i;
const ERROR_SELECTOR = '[role="alert"], [aria-live="assertive"], .error, .invalid-feedback, .help-block, [class*="error"], [class*="invalid"]';

/** La caja más grande alrededor del campo que no contiene ningún otro campo (su "zona"). */
function zoneOf(field: Element): Element {
  let zone: Element = field;
  while (zone.parentElement && zone.parentElement.tagName !== "FORM" && zone.parentElement.tagName !== "BODY") {
    const controls = zone.parentElement.querySelectorAll('input:not([type="hidden"]), select, textarea');
    if (controls.length > 1) break;
    zone = zone.parentElement;
  }
  return zone;
}

/** Texto de los mensajes de error visibles del formulario, para detectar los que aparecen nuevos. */
function errorMessages(scope: Element): Set<string> {
  const out = new Set<string>();
  for (const el of scope.querySelectorAll(ERROR_SELECTOR)) {
    if (el.matches("input, select, textarea, form")) continue;
    const text = el.textContent?.trim();
    if (text && isVisible(el)) out.add(text);
  }
  return out;
}

/** Mensaje de error enlazado al campo con aria-describedby o aria-errormessage. */
function linkedMessage(field: Element): string {
  const ids = `${field.getAttribute("aria-describedby") ?? ""} ${field.getAttribute("aria-errormessage") ?? ""}`.trim();
  if (!ids) return "";
  return ids
    .split(/\s+/)
    .map((id) => field.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
    .join(" ");
}

/**
 * Escribe un valor inválido y mira si el formulario lo rechaza de alguna forma: validación nativa,
 * aria-invalid, una clase de error en el campo o su caja, un texto nuevo junto al campo o un mensaje
 * de error nuevo. Lo que cambie en otras partes del formulario (desplegables que cargan, contadores,
 * precios) no cuenta: antes daba falsos "rechazado".
 */
export const probeRejects: Probe = async (field, value) => {
  const original = field.value;
  const form = field.closest("form") ?? field.ownerDocument.body;
  const zone = zoneOf(field);
  const box = zone.parentElement ?? zone;
  const before = {
    zoneText: zone.textContent ?? "",
    fieldClass: field.className,
    zoneClass: zone.className,
    boxClass: box.className,
    linked: linkedMessage(field),
    messages: errorMessages(form),
  };
  try {
    setNativeValue(field, value);
    await wait(300);
    if (!field.checkValidity()) return true;
    if (field.getAttribute("aria-invalid") === "true") return true;
    if (field.className !== before.fieldClass && ERROR_CLASS.test(field.className)) return true;
    if (zone.className !== before.zoneClass && ERROR_CLASS.test(zone.className)) return true;
    if (box.className !== before.boxClass && ERROR_CLASS.test(box.className)) return true;
    if ((zone.textContent ?? "") !== before.zoneText) return true;
    if (linkedMessage(field) !== before.linked) return true;
    for (const message of errorMessages(form)) if (!before.messages.has(message)) return true;
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
