import { expect, test } from "./fixtures";

test("stress test breaks the layout on purpose, finds what breaks and undoes everything", async ({ context, extensionId, serviceWorker, baseUrl }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto(`${baseUrl}/product`);
  const original = await page.evaluate(() => document.documentElement.outerHTML);
  const tabId = await serviceWorker.evaluate(async () => (await chrome.tabs.query({ url: "http://127.0.0.1/*" }))[0].id!);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tabId=${tabId}`);
  await popup.getByRole("button", { name: "EN" }).click();

  // Primero el probador de formularios…
  await popup.getByRole("tab", { name: /Forms/ }).click();
  await popup.getByRole("button", { name: "Test the forms on this page" }).click();
  await expect(page.locator("snagkit-forms")).toHaveCount(1);

  // …y al abrir el test de estrés, el panel de formularios se cierra solo: una herramienta a la vez
  // (el popup se cierra solo tras lanzar una herramienta, así que se abre uno nuevo; recuerda la última pestaña)
  const popup2 = await context.newPage();
  await popup2.goto(`chrome-extension://${extensionId}/popup/index.html?tabId=${tabId}`);
  await expect(popup2.getByRole("tab", { name: /Forms/ })).toHaveAttribute("aria-selected", "true");
  await popup2.getByRole("tab", { name: /Stress/ }).click();
  await popup2.getByRole("button", { name: "Open the stress test" }).click();
  await expect(page.locator("snagkit-stress")).toHaveCount(1);
  await expect(page.locator("snagkit-forms")).toHaveCount(0);

  const panel = page.getByRole("dialog", { name: "Snagkit" });
  await expect(panel.getByRole("status")).toContainText("problem");

  // La etiqueta con "…" ya estaba rota antes de tocar nada
  const before = await panel.locator(".problem").allTextContents();
  expect(before.join("|")).toContain("Text hidden behind “…”");
  expect(before.join("|")).toContain("Already there");

  // Texto más largo: el botón de ancho fijo corta "Add to cart" (ahora "⟦Ådd tö çárt…⟧")
  await panel.getByLabel(/Longer text/).check();
  await expect(page.locator("body > h1")).toContainText("⟦");
  await expect(panel.locator(".problem", { hasText: "Ådd tö çárt" })).toContainText("Text cut off");
  await expect(panel.locator(".problem", { hasText: "Ådd tö çárt" })).toContainText("New");

  // Texto al 200 %: el menú que no se adapta se sale de la pantalla
  await panel.getByLabel(/Text at 200%/).check();
  await expect(panel.locator(".problem", { hasText: "Goes off screen" }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/stress-page.png" });

  // Reportar crea un reporte con pasos y resultado esperado ya escritos
  const reportPromise = context.waitForEvent("page", (p) => p.url().includes("/report/index.html"));
  await panel.locator(".problem", { hasText: "Ådd tö çárt" }).getByRole("button", { name: /Report/ }).click();
  const report = await reportPromise;
  await report.waitForLoadState();
  await expect(report.getByLabel("Title")).toHaveValue(/^Text cut off — button "⟦Ådd tö çárt/);
  await expect(report.getByLabel("Steps to reproduce")).toHaveValue(/Apply: Longer text \(\+50%\)\n3\. Apply: Text at 200%/);
  await report.close();

  // Al cerrar, la página vuelve a estar exactamente como al principio
  await page.bringToFront();
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("snagkit-stress")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.outerHTML)).toBe(original);
});
