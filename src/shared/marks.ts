// Marcas visuales sobre elementos de la página (los recuadros de colores de los paneles).
// Se pintan con un atributo propio y una hoja de estilos propia, sin tocar el atributo style
// de la página: así no se mezclan con los cambios del test de estrés y se quitan sin dejar rastro.

export type MarkColor = "error" | "warning" | "new" | "existing";

const ATTR = "data-snagkit-mark";

const CSS = `
[${ATTR}="error"] { outline: 3px solid #f87171 !important; outline-offset: 2px !important; }
[${ATTR}="warning"] { outline: 3px solid #fbbf24 !important; outline-offset: 2px !important; }
[${ATTR}="new"] { outline: 2px dashed #f87171 !important; outline-offset: 1px !important; }
[${ATTR}="existing"] { outline: 2px dashed #fbbf24 !important; outline-offset: 1px !important; }`;

export function createMarker(doc: Document, owner: string) {
  const marked = new Set<Element>();
  let sheet: HTMLStyleElement | null = null;

  return {
    mark(el: Element, color: MarkColor) {
      if (!sheet) {
        sheet = doc.createElement("style");
        sheet.setAttribute("data-snagkit", `marks-${owner}`);
        sheet.textContent = CSS;
        (doc.head ?? doc.documentElement).append(sheet);
      }
      if (marked.has(el)) return;
      el.setAttribute(ATTR, color);
      marked.add(el);
    },
    clear() {
      for (const el of marked) el.removeAttribute(ATTR);
      marked.clear();
      sheet?.remove();
      sheet = null;
    },
  };
}
