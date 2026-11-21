import { LIMITS, type Step, type TabSession } from "./types";

export function emptySession(): TabSession {
  return { console: [], network: [], steps: [] };
}

function sameTarget(a: Step, b: Step): boolean {
  return "target" in a && "target" in b && a.target.role === b.target.role && a.target.label === b.target.label;
}

/** Añade un paso evitando ruido: escribir varias veces en el mismo campo cuenta como un paso. */
export function addStep(session: TabSession, step: Step): TabSession {
  const steps = [...session.steps];
  const last = steps[steps.length - 1];
  if (last) {
    if (step.kind === "navigate" && last.kind === "navigate" && last.url === step.url) return session;
    if (step.kind === "type" && last.kind === "type" && sameTarget(last, step)) {
      steps[steps.length - 1] = step;
      return { ...session, steps };
    }
    // Tras un clic en un <select> nativo llega el "elegir"; el clic sobra.
    if ((step.kind === "select" || step.kind === "check") && last.kind === "click" && sameTarget(last, step)) {
      steps[steps.length - 1] = step;
      return { ...session, steps };
    }
  }
  steps.push(step);
  return { ...session, steps: steps.slice(-LIMITS.steps) };
}

export function addEntry<K extends "console" | "network">(session: TabSession, key: K, entry: TabSession[K][number]): TabSession {
  const list = [...session[key], entry] as TabSession[K];
  return { ...session, [key]: list.slice(-LIMITS[key]) };
}
