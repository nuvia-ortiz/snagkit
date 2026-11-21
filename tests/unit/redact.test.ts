import { describe, expect, it } from "vitest";
import { isSensitiveParam, redactUrl } from "../../src/shared/redact";

describe("redactUrl()", () => {
  it("hides tokens and keys but keeps normal parameters", () => {
    expect(redactUrl("https://a.com/p?q=shoes&access_token=abc123&page=2")).toBe("https://a.com/p?q=shoes&access_token=[redacted]&page=2");
    expect(redactUrl("https://a.com/?apiKey=xyz")).toBe("https://a.com/?apiKey=[redacted]");
  });

  it("removes credentials embedded in the URL", () => {
    expect(redactUrl("https://user:pass@a.com/x")).toBe("https://a.com/x");
  });

  it("leaves URLs without secrets untouched", () => {
    const url = "https://a.com/search?keyword=red&postcode=28001";
    expect(redactUrl(url)).toBe(url);
  });

  it("does not break on invalid URLs", () => {
    expect(redactUrl("not a url")).toBe("not a url");
  });

  it("detects sensitive parameter names", () => {
    for (const n of ["token", "session_id", "sessionId", "api-key", "code", "X-Signature"]) expect(isSensitiveParam(n), n).toBe(true);
    for (const n of ["keyword", "postcode", "q", "page", "monkey"]) expect(isSensitiveParam(n), n).toBe(false);
  });
});
