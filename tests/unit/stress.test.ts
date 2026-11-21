import { describe, expect, it } from "vitest";
import { applyModes, pseudoLocalize } from "../../src/shared/stress";

describe("pseudoLocalize()", () => {
  it("adds accents, grows the text by about half and wraps it in markers", () => {
    const out = pseudoLocalize("Add to cart");
    expect(out.startsWith("⟦Ådd tö çárt")).toBe(true);
    expect(out.endsWith("⟧")).toBe(true);
    expect(out.length).toBeGreaterThanOrEqual(Math.ceil("Add to cart".length * 1.5));
  });

  it("keeps surrounding whitespace and ignores text without letters", () => {
    expect(pseudoLocalize("  Hi \n")).toMatch(/^ {2}⟦.*⟧ \n$/);
    expect(pseudoLocalize("  42 € ")).toBe("  42 € ");
  });
});

describe("applyModes()", () => {
  const page = `
    <h1 class="t">Welcome back</h1>
    <p>Hello <b>world</b></p>
    <input type="submit" value="Send">
    <script>var x = "do not touch";</script>
    <img src="/logo.png" srcset="/logo@2x.png 2x" alt="Logo">`;

  it("changes the page and restores it exactly", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = page;
    document.documentElement.removeAttribute("dir");
    const before = document.documentElement.outerHTML;

    const undo = applyModes(document, new Set(["longText", "spacing", "brokenImages", "rtl"]));
    expect(document.querySelector("h1")!.textContent).toContain("⟦");
    expect(document.querySelector("b")!.textContent).toContain("⟦");
    expect((document.querySelector("input") as HTMLInputElement).value).toContain("⟦");
    expect(document.querySelector("script")!.textContent).toBe('var x = "do not touch";');
    expect(document.querySelector("img")!.getAttribute("srcset")).toBe("");
    expect(document.querySelector("style[data-snagkit]")).not.toBeNull();
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");

    undo();
    expect(document.documentElement.outerHTML).toBe(before);
    expect((document.querySelector("input") as HTMLInputElement).value).toBe("Send");
  });

  it("does nothing when no mode is selected", () => {
    document.body.innerHTML = page;
    const before = document.body.innerHTML;
    applyModes(document, new Set())();
    expect(document.body.innerHTML).toBe(before);
  });
});
