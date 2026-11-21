/**
 * Guarda el atributo style tal cual estaba y devuelve cómo dejarlo idéntico,
 * incluso si el elemento no tenía atributo style (no deja un style="" vacío).
 */
export function snapshotStyle(el: Element): () => void {
  const original = el.getAttribute("style");
  return () => {
    if (original === null) {
      // Chrome escribe en el atributo los cambios de el.style de forma diferida. Si se borra el
      // atributo antes de esa sincronización, más tarde reaparece como style="". Leerlo la fuerza.
      el.getAttribute("style");
      (el as HTMLElement).style.cssText = "";
      el.removeAttribute("style");
    } else {
      el.setAttribute("style", original);
    }
  };
}
