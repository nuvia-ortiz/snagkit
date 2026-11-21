import type { Target } from "./types";

const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="option"], [contenteditable="true"]';

const TEXT_INPUTS = new Set(["text", "email", "search", "tel", "url", "number", "password", "date", "datetime-local", "month", "week", "time", ""]);

const MAX_LABEL = 60;

function clean(text: string | null | undefined): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > MAX_LABEL ? `${t.slice(0, MAX_LABEL - 1)}…` : t;
}

/** Sube desde el elemento pulsado hasta el control con el que el usuario quería interactuar. */
export function closestInteractive(el: Element): Element {
  return el.closest(INTERACTIVE) ?? el;
}

export function roleOf(el: Element): string {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "button" || tag === "summary") return "button";
  if (tag === "select") return "dropdown";
  if (tag === "textarea") return "field";
  if (tag === "img") return "image";
  if (tag === "label") return "label";
  if (tag === "input") {
    const type = (el as HTMLInputElement).type.toLowerCase();
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (["submit", "button", "reset", "image"].includes(type)) return "button";
    if (TEXT_INPUTS.has(type)) return "field";
    return type;
  }
  if ((el as HTMLElement).isContentEditable) return "field";
  if (/^h[1-6]$/.test(tag)) return "heading";
  return tag;
}

function labelFromLabels(el: Element): string {
  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length > 0) return clean(labels[0].textContent);
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" ");
    if (clean(text)) return clean(text);
  }
  return "";
}

/** Texto con el que una persona reconocería el elemento. Nunca devuelve lo que se ha escrito en un campo. */
export function labelOf(el: Element): string {
  const aria = clean(el.getAttribute("aria-label"));
  if (aria) return aria;

  const tag = el.tagName.toLowerCase();
  const isField = tag === "input" || tag === "select" || tag === "textarea";

  if (isField) {
    const fromLabel = labelFromLabels(el);
    if (fromLabel) return fromLabel;
    const input = el as HTMLInputElement;
    if (tag === "input" && ["submit", "button", "reset"].includes(input.type) && input.value) return clean(input.value);
    const placeholder = clean(el.getAttribute("placeholder"));
    if (placeholder) return placeholder;
    const title = clean(el.getAttribute("title"));
    if (title) return title;
    return clean(el.getAttribute("name") ?? el.id);
  }

  const fromLabel = labelFromLabels(el);
  if (fromLabel) return fromLabel;
  const alt = clean(el.getAttribute("alt"));
  if (alt) return alt;
  const text = clean(el.textContent);
  if (text) return text;
  const imgAlt = clean(el.querySelector("img[alt]")?.getAttribute("alt"));
  if (imgAlt) return imgAlt;
  const title = clean(el.getAttribute("title"));
  if (title) return title;
  return clean(el.id || el.getAttribute("name") || "");
}

export function describe(el: Element): Target {
  return { role: roleOf(el), label: labelOf(el) };
}
