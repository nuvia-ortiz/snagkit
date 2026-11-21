import { beforeEach, describe as group, expect, it } from "vitest";
import { closestInteractive, describe } from "../../src/shared/describe";

const $ = (sel: string) => document.querySelector(sel)!;

group("describe()", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="b"><span id="inner">Pay now</span></button>
      <a href="/cart" id="a"><img src="x.png" alt="Cart"></a>
      <label for="email">Email address</label><input id="email" type="email" value="secret@mail.com">
      <input id="ph" placeholder="Search cars">
      <input id="sub" type="submit" value="Send">
      <input id="cb" type="checkbox" aria-label="Accept terms">
      <select id="sel" name="size"><option>M</option></select>
      <div role="button" id="custom">Open menu</div>
    `;
  });

  it("climbs from an inner span to the button", () => {
    expect(describe(closestInteractive($("#inner")))).toEqual({ role: "button", label: "Pay now" });
  });

  it("uses the image alt for icon links", () => {
    expect(describe($("#a"))).toEqual({ role: "link", label: "Cart" });
  });

  it("uses the <label> of a field and never its value", () => {
    const t = describe($("#email"));
    expect(t).toEqual({ role: "field", label: "Email address" });
    expect(JSON.stringify(t)).not.toContain("secret");
  });

  it("falls back to placeholder, submit value, aria-label and name", () => {
    expect(describe($("#ph")).label).toBe("Search cars");
    expect(describe($("#sub"))).toEqual({ role: "button", label: "Send" });
    expect(describe($("#cb"))).toEqual({ role: "checkbox", label: "Accept terms" });
    expect(describe($("#sel"))).toEqual({ role: "dropdown", label: "size" });
  });

  it("respects explicit roles", () => {
    expect(describe($("#custom"))).toEqual({ role: "button", label: "Open menu" });
  });

  it("shortens very long labels", () => {
    document.body.innerHTML = `<button id="long">${"word ".repeat(40)}</button>`;
    expect(describe($("#long")).label.length).toBeLessThanOrEqual(60);
  });
});
