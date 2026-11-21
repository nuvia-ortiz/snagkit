import { test as base, chromium, type BrowserContext, type Worker } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";

const EXTENSION = resolve(import.meta.dirname, "../../dist");

/** Página de pruebas con un formulario, un error de consola y peticiones que fallan. */
const SHOP = `<!doctype html>
<html lang="en"><head><title>Test shop</title></head>
<body style="font-family:sans-serif;padding:40px">
  <h1>Checkout</h1>
  <form id="checkout" aria-label="Checkout" onsubmit="event.preventDefault(); pay();">
    <label for="email">Email</label>
    <input id="email" type="email">
    <label for="plan">Plan</label>
    <select id="plan"><option>Basic</option><option>Pro</option></select>
    <label><input type="checkbox" id="terms"> Accept terms</label>
    <button type="submit">Pay now</button>
  </form>
  <img src="/missing.png" alt="">
  <script>
    async function pay() {
      const res = await fetch("/api/pay?token=supersecret", { method: "POST" });
      if (!res.ok) console.error("Payment failed with status " + res.status);
    }
  </script>
</body></html>`;

type Fixtures = { context: BrowserContext; serviceWorker: Worker; extensionId: string; baseUrl: string };

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  baseUrl: async ({}, use) => {
    const server: Server = createServer((req, res) => {
      if (req.url === "/") {
        res.writeHead(200, { "content-type": "text/html" }).end(SHOP);
      } else if (req.url?.startsWith("/api/pay")) {
        res.writeHead(500, { "content-type": "application/json" }).end('{"error":"boom"}');
      } else {
        res.writeHead(404).end("not found");
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };
    await use(`http://127.0.0.1:${port}`);
    server.close();
  },

  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const [existing] = context.serviceWorkers();
    await use(existing ?? (await context.waitForEvent("serviceworker")));
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
