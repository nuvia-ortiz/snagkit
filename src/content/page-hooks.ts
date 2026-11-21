// Se ejecuta dentro de la propia página (world: MAIN) para poder ver sus errores de consola
// y sus cambios de URL en aplicaciones de una sola página. No tiene acceso a las APIs de Chrome:
// envía lo que ve al content script aislado (recorder.ts) mediante window.postMessage.

const TAG = "__snagkit__";
const LOADED = "__snagkitHooks__";
const MAX = 2000;

function format(value: unknown): string {
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function send(payload: Record<string, unknown>) {
  try {
    window.postMessage({ [TAG]: true, ...payload }, window.location.origin === "null" ? "*" : window.location.origin);
  } catch {
    // la página puede haber bloqueado postMessage; no rompemos nada
  }
}

function sendConsole(level: "error" | "warn", message: string, source?: string) {
  send({ kind: "console", entry: { t: Date.now(), level, message: message.slice(0, MAX), source } });
}

function notifyNavigation() {
  send({ kind: "navigate", url: window.location.href });
}

function install() {
  for (const level of ["error", "warn"] as const) {
    const original = console[level];
    console[level] = function (...args: unknown[]) {
      sendConsole(level, args.map(format).join(" "));
      return original.apply(this, args);
    };
  }

  window.addEventListener("error", (event) => {
    // Los errores de carga de recursos (imágenes, scripts) ya los registra la parte de red.
    if (!(event instanceof ErrorEvent)) return;
    const where = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined;
    sendConsole("error", event.error ? format(event.error) : event.message, where);
  });

  window.addEventListener("unhandledrejection", (event) => {
    sendConsole("error", `Unhandled promise rejection: ${format(event.reason)}`);
  });

  // Cambios de URL sin recarga (React Router, Next.js, Vue Router…)
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (...args: Parameters<History["pushState"]>) {
      const before = window.location.href;
      const result = original.apply(this, args);
      if (window.location.href !== before) notifyNavigation();
      return result;
    };
  }
  window.addEventListener("popstate", notifyNavigation);
}

// Al reactivar la grabación el script puede inyectarse otra vez en la misma página.
const flags = window as unknown as Record<string, boolean>;
if (!flags[LOADED]) {
  flags[LOADED] = true;
  install();
}
