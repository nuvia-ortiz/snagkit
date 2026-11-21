// Content script aislado: graba los pasos del usuario y reenvía al service worker
// lo que detecta page-hooks.ts. Nunca guarda lo que se escribe en los campos.
// Solo se inyecta mientras la grabación está activa; si se pausa con la página abierta,
// deja de enviar nada al instante.

import { closestInteractive, describe } from "../shared/describe";
import type { ConsoleEntry, Message, Step } from "../shared/types";

const TAG = "__snagkit__";
const LOADED = "__snagkitRecorder__";

let active = true;
try {
  chrome.storage.local.get("recording").then(({ recording }) => (active = recording === true));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.recording) active = changes.recording.newValue === true;
  });
} catch {
  // la extensión se recargó
}

function send(message: Message) {
  if (!active) return;
  try {
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch {
    // la extensión se recargó: este script ya no está conectado
  }
}

function record(step: Step) {
  send({ type: "step", step });
}

// Solo grabamos el documento principal, no iframes de anuncios o widgets,
// y una sola vez aunque el script se inyecte de nuevo al reactivar la grabación.
const w = window as unknown as Record<string, boolean>;
if (window === window.top && !w[LOADED]) {
  w[LOADED] = true;
  record({ t: Date.now(), kind: "navigate", url: location.href });

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data[TAG] !== true) return;
    const data = event.data as { kind: string; entry?: ConsoleEntry; url?: string };
    if (data.kind === "console" && data.entry) send({ type: "console", entry: data.entry });
    if (data.kind === "navigate" && data.url) record({ t: Date.now(), kind: "navigate", url: data.url });
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const el = closestInteractive(event.target);
      // Los clics en campos de texto y desplegables ya se reflejan como "escribir" o "elegir".
      if (el.matches('select, textarea, input:not([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="reset"], [type="image"])'))
        return;
      // Las casillas se graban con su estado en el evento change.
      if (el.matches('input[type="checkbox"], input[type="radio"]')) return;
      // Pulsar una <label> de casilla genera un segundo clic sobre la casilla; basta con el change.
      if (el.tagName === "LABEL" && (el as HTMLLabelElement).control?.matches('input[type="checkbox"], input[type="radio"]')) return;
      record({ t: Date.now(), kind: "click", target: describe(el) });
    },
    true,
  );

  document.addEventListener(
    "change",
    (event) => {
      // Sin filtrar isTrusted: cambiar .value por código no dispara "change", y algunas
      // librerías de componentes lanzan su propio evento change al elegir una opción.
      if (!(event.target instanceof Element)) return;
      const el = event.target;
      const target = describe(el);
      if (el instanceof HTMLSelectElement) {
        const value = [...el.selectedOptions].map((o) => o.text.trim()).join(", ");
        record({ t: Date.now(), kind: "select", target, value });
      } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        record({ t: Date.now(), kind: "check", target, checked: el.checked });
      }
    },
    true,
  );

  // Escribir se registra al empezar (evento input), no al salir del campo, para que el orden
  // de los pasos sea el real. Las pulsaciones seguidas en el mismo campo se agrupan en uno.
  document.addEventListener(
    "input",
    (event) => {
      const el = event.target;
      const isText =
        (el instanceof HTMLInputElement && !["checkbox", "radio", "file", "range", "color"].includes(el.type)) ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (isText) record({ t: Date.now(), kind: "type", target: describe(el as Element) });
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      const form = event.target;
      const name = form.getAttribute("aria-label") || form.getAttribute("name") || form.id || "";
      record({ t: Date.now(), kind: "submit", target: { role: "form", label: name } });
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (!event.isTrusted || (event.key !== "Enter" && event.key !== "Escape")) return;
      if (!(event.target instanceof Element)) return;
      if (event.key === "Enter" && event.target.matches("textarea, [contenteditable]")) return;
      record({ t: Date.now(), kind: "key", key: event.key, target: describe(closestInteractive(event.target)) });
    },
    true,
  );
}
