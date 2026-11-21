import { expect, test } from "./fixtures";

test("form tester finds problems, never submits, and turns an issue into a report", async ({ context, extensionId, serviceWorker, baseUrl, submissions }) => {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/signup`);
  const tabId = await serviceWorker.evaluate(async () => (await chrome.tabs.query({ url: "http://127.0.0.1/*" }))[0].id!);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tabId=${tabId}`);
  await popup.getByRole("button", { name: "EN" }).click();
  await page.bringToFront();
  await popup.getByRole("button", { name: "Run" }).click();

  // El panel vive en un Shadow DOM abierto; los locators de Playwright lo atraviesan.
  const panel = page.getByRole("dialog", { name: "Snagkit" });
  await expect(panel.getByText("1 form", { exact: true })).toBeVisible({ timeout: 10_000 });

  const text = await panel.textContent();
  expect(text).toContain("Placeholder is the only label");
  expect(text).toContain("Field has no label");
  expect(text).toContain('Should be type="email"');
  expect(text).toContain("Accepts an invalid value: “test@”");
  expect(text).toContain("Accepts an invalid value: “abcdef”");
  expect(text).toContain("Button has no name");
  expect(text).toContain("Label points to a missing field (#nowhere)");
  expect(text).toContain("Missing autocomplete");

  // Nada enviado y los valores originales intactos
  expect(submissions).toEqual([]);
  await expect(page.getByLabel("Email")).toHaveValue("keep@me.com");
  await expect(page.getByLabel("Phone")).toHaveValue("");

  await panel.screenshot({ path: "test-results/forms-panel.png" });
  await page.screenshot({ path: "test-results/forms-page.png" });

  // "Reportar" crea un reporte con el título rellenado y el campo recuadrado en la captura
  const reportPromise = context.waitForEvent("page", (p) => p.url().includes("/report/index.html"));
  const invalidEmail = panel.locator(".issue", { hasText: "Accepts an invalid value: “test@”" });
  await invalidEmail.getByRole("button", { name: /Report/ }).click();
  const report = await reportPromise;
  await report.waitForLoadState();
  await expect(report.getByLabel("Title")).toHaveValue('Accepts an invalid value: “test@” — field "Email"');
  await expect(report.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
  await expect(report.getByLabel("Steps to reproduce")).toHaveValue(`1. Open ${baseUrl}/signup
2. Type "test@" in field "Email"
3. Move to the next field`);
  await expect(report.getByLabel("What did you expect?")).toHaveValue(/clear error message/);
  await expect(report.getByRole("button", { name: /Undo/ })).toBeEnabled();
  await report.setViewportSize({ width: 1440, height: 900 });
  await report.screenshot({ path: "test-results/forms-report.png" });
});
