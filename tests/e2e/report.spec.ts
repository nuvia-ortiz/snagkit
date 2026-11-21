import { expect, test } from "./fixtures";

test("records a session and turns it into a bug report", async ({ context, extensionId, serviceWorker, baseUrl }) => {
  const page = await context.newPage();
  await page.goto(baseUrl);

  const tabId = await serviceWorker.evaluate(async () => (await chrome.tabs.query({ url: "http://127.0.0.1/*" }))[0].id!);
  const session = () =>
    serviceWorker.evaluate(async (id) => (await chrome.storage.session.get(`tab:${id}`))[`tab:${id}`], tabId) as Promise<
      { console: unknown[]; steps: { kind: string }[] } | undefined
    >;

  // En pausa (estado inicial) no se graba nada
  await page.getByLabel("Email").fill("ignored@example.com");
  await page.waitForTimeout(300);
  expect(await session()).toBeUndefined();

  // Se activa desde el popup con la página ya abierta, sin recargarla
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html?tabId=${tabId}`);
  await popup.getByRole("button", { name: "EN" }).click();
  await expect(popup.getByText("Paused")).toBeVisible();
  await popup.getByRole("button", { name: /Start recording/ }).click();
  await expect(popup.getByText("Recording", { exact: true })).toBeVisible();
  await expect.poll(async () => (await session())?.steps.length ?? 0).toBeGreaterThan(0);

  // Lo que haría una persona probando la página
  await page.bringToFront();
  await page.getByLabel("Email").fill("tester@example.com");
  await page.getByLabel("Plan").selectOption("Pro");
  await page.getByLabel("Accept terms").check();
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect.poll(async () => (await session())?.console.length ?? 0).toBeGreaterThan(0);

  // Al pausar deja de grabar al instante, aunque la página siga abierta
  await popup.getByRole("button", { name: /Pause/ }).click();
  await expect(popup.getByText("Paused")).toBeVisible();
  const stepsBefore = (await session())!.steps.length;
  await page.getByLabel("Plan").selectOption("Basic");
  await page.waitForTimeout(300);
  expect((await session())!.steps.length).toBe(stepsBefore);

  await popup.getByRole("button", { name: /Start recording/ }).click();
  await expect(popup.getByText("Console errors")).toBeVisible();
  await popup.locator("main").screenshot({ path: "test-results/popup.png" });

  await page.bringToFront();
  const reportPromise = context.waitForEvent("page", (p) => p.url().includes("/report/index.html"));
  await popup.getByRole("button", { name: "Report a bug" }).click();
  const report = await reportPromise;
  await report.waitForLoadState();

  await report.getByLabel("Title").fill("Pay now shows nothing when the payment fails");
  await report.getByRole("button", { name: "High" }).click();
  await report.getByText("Report · Markdown").click();

  const md = await report.getByTestId("markdown").textContent();
  expect(md).toContain("## Pay now shows nothing when the payment fails");
  expect(md).toContain("**Severity:** High");
  expect(md).toContain(`1. Open ${baseUrl}/`);
  expect(md).toContain('2. Type in field "Email"');
  expect(md).toContain('3. Select "Pro" in dropdown "Plan"');
  expect(md).toContain('Check checkbox "Accept terms"');
  expect(md).toContain('Click button "Pay now"');
  expect(md).toContain("Payment failed with status 500");
  expect(md).toContain("POST 500");
  // La imagen rota falló al cargar la página, cuando la grabación aún estaba en pausa
  expect(md).not.toContain("missing.png");
  expect(md).not.toContain("Basic");

  // Privacidad: ni lo escrito en el formulario ni el token de la URL aparecen en el reporte
  expect(md).not.toContain("tester@example.com");
  expect(md).not.toContain("supersecret");

  // Anotación sobre la captura
  const canvas = report.getByTestId("annotator");
  await report.evaluate(() => window.scrollTo(0, 0));
  const box = (await canvas.boundingBox())!;
  await report.mouse.move(box.x + 40, box.y + 40);
  await report.mouse.down();
  await report.mouse.move(box.x + 300, box.y + 160, { steps: 5 });
  await report.mouse.up();
  await expect(report.getByRole("button", { name: /Undo/ })).toBeEnabled();

  await report.setViewportSize({ width: 1440, height: 1000 });
  await report.screenshot({ path: "test-results/report.png", fullPage: true });
});
