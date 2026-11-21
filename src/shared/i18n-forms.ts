import type { FormRule } from "./forms";
import type { Lang } from "./types";

type RuleText = { title: string; help: string };

type FormsDict = {
  name: string;
  running: string;
  safe: string;
  noForms: string;
  allGood: string;
  forms: (n: number) => string;
  fields: (n: number) => string;
  errors: (n: number) => string;
  warnings: (n: number) => string;
  error: string;
  warning: string;
  show: string;
  report: string;
  copy: string;
  copied: string;
  rerun: string;
  close: string;
  looseFields: string;
  field: string;
  form: string;
  stepsFor: (url: string, field: string, value?: string) => string;
  expectedInvalid: string;
  rules: Record<FormRule, RuleText>;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const formsText: Record<Lang, FormsDict> = {
  en: {
    name: "Form tester",
    running: "Testing forms…",
    safe: "Nothing is submitted. Every field gets its original value back.",
    noForms: "No forms found on this page.",
    allGood: "No problems found",
    forms: (n) => plural(n, "form", "forms"),
    fields: (n) => plural(n, "field", "fields"),
    errors: (n) => plural(n, "error", "errors"),
    warnings: (n) => plural(n, "warning", "warnings"),
    error: "Error",
    warning: "Warning",
    show: "Show",
    report: "Report",
    copy: "Copy results",
    copied: "Copied",
    rerun: "Run again",
    close: "Close",
    looseFields: "Fields outside a form",
    field: "Field",
    form: "Form",
    stepsFor: (url, field, value) =>
      value ? `1. Open ${url}
2. Type "${value}" in ${field}
3. Move to the next field` : `1. Open ${url}
2. Inspect ${field}`,
    expectedInvalid: "The field shows a clear error message and the form can't be sent until the value is fixed.",
    rules: {
      "no-label": {
        title: "Field has no label",
        help: "Screen readers announce it only as “edit text”, and clicking the text next to it doesn't focus it. Add a <label> or an aria-label.",
      },
      "placeholder-label": {
        title: "Placeholder is the only label",
        help: "The hint disappears as soon as someone types, and some screen readers skip it. Add a visible label.",
      },
      "wrong-type": {
        title: "Should be type=\"{detail}\"",
        help: "The field is type=\"text\". Using type=\"{detail}\" shows the right mobile keyboard and adds free browser validation.",
      },
      "no-autocomplete": {
        title: "Missing autocomplete",
        help: "Without an autocomplete attribute the browser can't fill in personal data for the user (WCAG 1.3.5).",
      },
      "accepts-invalid": {
        title: "Accepts an invalid value: “{detail}”",
        help: "After typing “{detail}” the field showed no error. Add validation and a clear error message.",
      },
      "unnamed-button": {
        title: "Button has no name",
        help: "The button has no text, aria-label or value, so screen readers can't say what it does.",
      },
      "no-submit": {
        title: "Form has no submit button",
        help: "Without a submit button the form can't be sent with the Enter key, and assistive technology can't find how to send it.",
      },
      "broken-label": {
        title: "Label points to a missing field (#{detail})",
        help: "The label's for attribute doesn't match any id, so the label isn't linked to its field.",
      },
      "duplicate-id": {
        title: "Duplicate id “{detail}”",
        help: "Several fields share this id. Labels and scripts may end up pointing at the wrong field.",
      },
      "insecure-password": {
        title: "Password sent without HTTPS",
        help: "The password field is on a page or form that doesn't use HTTPS, so the password travels unencrypted.",
      },
    },
  },
  es: {
    name: "Probador de formularios",
    running: "Probando formularios…",
    safe: "No se envía nada. Cada campo recupera su valor original.",
    noForms: "No hay formularios en esta página.",
    allGood: "Sin problemas",
    forms: (n) => plural(n, "formulario", "formularios"),
    fields: (n) => plural(n, "campo", "campos"),
    errors: (n) => plural(n, "error", "errores"),
    warnings: (n) => plural(n, "aviso", "avisos"),
    error: "Error",
    warning: "Aviso",
    show: "Ver",
    report: "Reportar",
    copy: "Copiar resultados",
    copied: "Copiado",
    rerun: "Repetir",
    close: "Cerrar",
    looseFields: "Campos fuera de un formulario",
    field: "Campo",
    form: "Formulario",
    stepsFor: (url, field, value) =>
      value ? `1. Abrir ${url}
2. Escribir "${value}" en ${field}
3. Pasar al siguiente campo` : `1. Abrir ${url}
2. Revisar ${field}`,
    expectedInvalid: "El campo muestra un mensaje de error claro y el formulario no se puede enviar hasta corregir el valor.",
    rules: {
      "no-label": {
        title: "Campo sin etiqueta",
        help: "Los lectores de pantalla lo anuncian solo como «editar texto», y al pulsar el texto de al lado no se activa el campo. Añade un <label> o un aria-label.",
      },
      "placeholder-label": {
        title: "El texto de ejemplo es la única etiqueta",
        help: "La pista desaparece en cuanto se escribe y algunos lectores de pantalla la ignoran. Añade una etiqueta visible.",
      },
      "wrong-type": {
        title: "Debería ser type=\"{detail}\"",
        help: "El campo es type=\"text\". Con type=\"{detail}\" el móvil muestra el teclado adecuado y el navegador valida gratis.",
      },
      "no-autocomplete": {
        title: "Falta autocomplete",
        help: "Sin el atributo autocomplete el navegador no puede rellenar los datos personales del usuario (WCAG 1.3.5).",
      },
      "accepts-invalid": {
        title: "Acepta un valor inválido: «{detail}»",
        help: "Tras escribir «{detail}» el campo no mostró ningún error. Añade validación y un mensaje de error claro.",
      },
      "unnamed-button": {
        title: "Botón sin nombre",
        help: "El botón no tiene texto, aria-label ni value, así que los lectores de pantalla no pueden decir qué hace.",
      },
      "no-submit": {
        title: "Formulario sin botón de enviar",
        help: "Sin botón de enviar no se puede mandar con la tecla Intro, y las tecnologías de apoyo no encuentran cómo enviarlo.",
      },
      "broken-label": {
        title: "Etiqueta que apunta a un campo que no existe (#{detail})",
        help: "El atributo for de la etiqueta no coincide con ningún id, así que no está unida a su campo.",
      },
      "duplicate-id": {
        title: "Id duplicado «{detail}»",
        help: "Varios campos comparten este id. Las etiquetas y los scripts pueden acabar apuntando al campo equivocado.",
      },
      "insecure-password": {
        title: "Contraseña enviada sin HTTPS",
        help: "El campo de contraseña está en una página o formulario sin HTTPS, así que la contraseña viaja sin cifrar.",
      },
    },
  },
};

export function ruleText(lang: Lang, rule: FormRule, detail?: string): RuleText {
  const r = formsText[lang].rules[rule];
  const fill = (s: string) => s.replaceAll("{detail}", detail ?? "");
  return { title: fill(r.title), help: fill(r.help) };
}
