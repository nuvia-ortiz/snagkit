import { describe, expect, it } from "vitest";
import { stepsToText } from "../../src/shared/i18n";
import { githubIssueUrl, parseBrowser, parseOs, toJira, toMarkdown } from "../../src/shared/report";
import type { ReportDraft, ReportForm } from "../../src/shared/types";

const draft: ReportDraft = {
  id: "1",
  createdAt: 0,
  screenshot: "",
  env: {
    url: "https://shop.test/checkout?session=abc",
    title: "Checkout",
    userAgent: "",
    browser: "Chrome 142",
    os: "Windows 10/11",
    language: "es-ES",
    viewport: "1280×720",
    screen: "1920×1080",
    pixelRatio: 1,
    timestamp: "2026-11-21 10:00:00 UTC",
  },
  session: {
    console: [{ t: 0, level: "error", message: "TypeError: x is undefined" }],
    network: [{ t: 0, method: "POST", url: "https://api.shop.test/pay?token=zzz", status: 500, type: "xmlhttprequest" }],
    steps: [
      { t: 0, kind: "navigate", url: "https://shop.test/checkout" },
      { t: 1, kind: "type", target: { role: "field", label: "Card number" } },
      { t: 2, kind: "click", target: { role: "button", label: "Pay" } },
    ],
  },
};

const form: ReportForm = {
  title: "Pay button fails",
  severity: "high",
  description: "Nothing happens",
  expected: "Order confirmed",
  steps: stepsToText(draft.session.steps, "en"),
  include: { env: true, console: true, network: true },
};

describe("stepsToText()", () => {
  it("writes readable numbered steps in both languages", () => {
    expect(stepsToText(draft.session.steps, "en")).toBe('1. Open https://shop.test/checkout\n2. Type in field "Card number"\n3. Click button "Pay"');
    expect(stepsToText(draft.session.steps, "es")).toContain('3. Pulsar botón "Pay"');
  });
});

describe("toMarkdown()", () => {
  const md = toMarkdown({ draft, form, lang: "en" });

  it("includes every section", () => {
    expect(md).toContain("## Pay button fails");
    expect(md).toContain("**Severity:** High");
    expect(md).toContain("### Steps to reproduce");
    expect(md).toContain("TypeError: x is undefined");
    expect(md).toContain("POST 500");
  });

  it("never leaks secrets from URLs", () => {
    expect(md).not.toContain("abc");
    expect(md).not.toContain("zzz");
  });

  it("omits sections that are switched off", () => {
    const short = toMarkdown({ draft, form: { ...form, include: { env: false, console: false, network: false } }, lang: "en" });
    expect(short).not.toContain("TypeError");
    expect(short).not.toContain("| Browser |");
  });
});

describe("toJira()", () => {
  it("uses Jira wiki markup", () => {
    const jira = toJira({ draft, form, lang: "en" });
    expect(jira).toContain("h2. Pay button fails");
    expect(jira).toContain('# Click button "Pay"');
    expect(jira).toContain("{noformat}");
  });
});

describe("githubIssueUrl()", () => {
  it("builds a prefilled issue link", () => {
    const r = githubIssueUrl("https://github.com/acme/shop/", "Bug", "Body")!;
    expect(r.url).toBe("https://github.com/acme/shop/issues/new?title=Bug&body=Body");
    expect(r.truncated).toBe(false);
  });

  it("rejects invalid repositories", () => {
    expect(githubIssueUrl("not a repo", "a", "b")).toBeNull();
  });

  it("shortens bodies that are too long for a URL", () => {
    const r = githubIssueUrl("acme/shop", "Bug", "x".repeat(20000))!;
    expect(r.truncated).toBe(true);
    expect(r.url.length).toBeLessThanOrEqual(7500);
  });
});

describe("user agent parsing", () => {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
  it("detects browser and OS", () => {
    expect(parseBrowser(ua)).toBe("Chrome 142");
    expect(parseOs(ua)).toBe("Windows 10/11");
    expect(parseBrowser(`${ua} Edg/142.0.1`)).toBe("Edge 142");
  });
});
