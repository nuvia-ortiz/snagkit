import { beforeEach, describe, expect, it } from "vitest";
import { analyzeForms, kindOf, probeRejects, type FormRule } from "../../src/shared/forms";

const rules = (issues: { rule: FormRule; target: { label: string } }[]) => issues.map((i) => `${i.rule}:${i.target.label}`);

describe("analyzeForms() static checks", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="signup" aria-label="Sign up">
        <input name="firstname">
        <input placeholder="Your email" name="email" type="text">
        <label for="phone">Phone</label><input id="phone" name="phone" type="tel" autocomplete="tel">
        <label for="ghost">Ghost</label>
        <label for="dup">A</label><input id="dup" name="a" autocomplete="off">
        <input id="dup" name="b" aria-label="B">
        <input type="hidden" name="csrf">
        <button><svg></svg></button>
      </form>
      <form aria-label="Good"><label for="q">Search</label><input id="q" name="q"><button>Go</button></form>
    `;
  });

  it("finds the classic accessibility and markup problems", async () => {
    const [signup, good] = await analyzeForms(document, { probe: false });
    expect(signup.name).toBe("Sign up");
    expect(rules(signup.issues)).toEqual(
      expect.arrayContaining([
        "no-label:firstname",
        "no-autocomplete:firstname",
        "placeholder-label:Your email",
        "wrong-type:Your email",
        "no-autocomplete:Your email",
        "unnamed-button:",
        "broken-label:Ghost",
        "duplicate-id:A",
      ]),
    );
    expect(rules(signup.issues)).not.toContain("no-autocomplete:Phone");
    expect(good.issues).toEqual([]);
  });

  it("ignores hidden fields", async () => {
    const [signup] = await analyzeForms(document, { probe: false });
    expect(signup.issues.some((i) => i.target.label === "csrf")).toBe(false);
  });

  it("groups fields that live outside any <form>", async () => {
    document.body.innerHTML = `<div><input name="email"></div>`;
    const reports = await analyzeForms(document, { probe: false });
    expect(reports).toHaveLength(1);
    expect(reports[0].fields).toBe(1);
  });
});

describe("kindOf()", () => {
  it("guesses what a field is for from its name, label or type", () => {
    document.body.innerHTML = `
      <input id="a" type="email"><input id="b" name="telefono"><label for="c">Correo electrónico</label><input id="c">
      <input id="d" name="user_website"><input id="e" name="comment">`;
    const k = (id: string) => kindOf(document.getElementById(id)!);
    expect([k("a"), k("b"), k("c"), k("d"), k("e")]).toEqual(["email", "tel", "email", "url", null]);
  });
});

describe("validation probing", () => {
  it("flags fields that accept invalid values and restores what was typed", async () => {
    document.body.innerHTML = `
      <form aria-label="Contact">
        <label for="e1">Email</label><input id="e1" type="email" value="kept@example.com">
        <label for="e2">Email again</label><input id="e2" name="email2" type="text" autocomplete="email">
        <label for="p">Phone</label><input id="p" name="phone" pattern="[0-9 +]+" autocomplete="tel">
        <button>Send</button>
      </form>`;
    const [contact] = await analyzeForms(document);
    const invalid = contact.issues.filter((i) => i.rule === "accepts-invalid").map((i) => `${i.target.label}=${i.detail}`);
    expect(invalid).toEqual(["Email again=test@"]);
    expect((document.getElementById("e1") as HTMLInputElement).value).toBe("kept@example.com");
  });

  it("counts custom JavaScript validation (aria-invalid) as a rejection", async () => {
    document.body.innerHTML = `<form><input id="t" name="phone"></form>`;
    const field = document.getElementById("t") as HTMLInputElement;
    field.addEventListener("input", () => field.setAttribute("aria-invalid", /\D/.test(field.value) ? "true" : "false"));
    expect(await probeRejects(field, "abcdef")).toBe(true);
    expect(field.value).toBe("");
  });
});
