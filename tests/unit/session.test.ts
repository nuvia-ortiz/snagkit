import { describe, expect, it } from "vitest";
import { addEntry, addStep, emptySession } from "../../src/shared/session";
import { LIMITS } from "../../src/shared/types";

const field = { role: "field", label: "Email" };

describe("addStep()", () => {
  it("merges consecutive typing in the same field", () => {
    let s = emptySession();
    s = addStep(s, { t: 1, kind: "type", target: field });
    s = addStep(s, { t: 2, kind: "type", target: field });
    expect(s.steps).toHaveLength(1);
    expect(s.steps[0].t).toBe(2);
  });

  it("ignores repeated navigation to the same URL", () => {
    let s = emptySession();
    s = addStep(s, { t: 1, kind: "navigate", url: "https://a.com" });
    s = addStep(s, { t: 2, kind: "navigate", url: "https://a.com" });
    expect(s.steps).toHaveLength(1);
  });

  it("keeps only the most recent steps", () => {
    let s = emptySession();
    for (let i = 0; i < LIMITS.steps + 10; i++) s = addStep(s, { t: i, kind: "click", target: { role: "button", label: `B${i}` } });
    expect(s.steps).toHaveLength(LIMITS.steps);
    expect(s.steps.at(-1)!.t).toBe(LIMITS.steps + 9);
  });
});

describe("addEntry()", () => {
  it("caps console entries", () => {
    let s = emptySession();
    for (let i = 0; i < LIMITS.console + 5; i++) s = addEntry(s, "console", { t: i, level: "error", message: `e${i}` });
    expect(s.console).toHaveLength(LIMITS.console);
  });
});
