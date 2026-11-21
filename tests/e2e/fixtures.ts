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

/** Formulario de registro con errores típicos para el probador de formularios. */
const SIGNUP = `<!doctype html>
<html lang="en"><head><title>Sign up</title></head>
<body style="font-family:sans-serif;padding:40px;max-width:520px">
  <h1>Create your account</h1>
  <form id="signup" aria-label="Sign up" method="post" action="/signup">
    <p><input name="fullname" placeholder="Full name"></p>
    <p><label for="email">Email</label><input id="email" name="email" type="text" value="keep@me.com"></p>
    <p><label for="phone">Phone</label><input id="phone" name="phone" autocomplete="tel"></p>
    <p><input name="company"></p>
    <p><label for="nowhere">Newsletter</label></p>
    <p><button type="submit"><svg width="16" height="16"></svg></button></p>
  </form>
</body></html>`;

/** Página con un diseño frágil: un botón de ancho fijo, una etiqueta con "…" y un menú que no se adapta. */
const PRODUCT = `<!doctype html>
<html lang="en"><head><title>Product</title>
<style>
  body { font-family: sans-serif; margin: 0; padding: 32px; }
  .buy { width: 120px; height: 36px; overflow: hidden; white-space: nowrap; background: #111; color: #fff; border: 0; }
  .tag { display: inline-block; max-width: 140px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .menu { display: flex; gap: 24px; white-space: nowrap; }
</style></head>
<body>
  <nav class="menu"><a href="#">Home</a><a href="#">New arrivals</a><a href="#">Collections</a><a href="#">Contact us</a></nav>
  <h1>Leather backpack</h1>
  <p><span class="tag">Free shipping on every order over 50 euros</span></p>
  <img src="/missing.png" alt="Backpack" width="200" height="120">
  <p><button class="buy">Add to cart</button></p>
</body></html>`;

type Fixtures = { context: BrowserContext; serviceWorker: Worker; extensionId: string; baseUrl: string; submissions: string[] };

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  submissions: async ({}, use) => {
    await use([]);
  },

  baseUrl: async ({ submissions }, use) => {
    const server: Server = createServer((req, res) => {
      if (req.method === "POST" && req.url === "/signup") submissions.push(req.url);
      if (req.url === "/product") {
        res.writeHead(200, { "content-type": "text/html" }).end(PRODUCT);
      } else if (req.url === "/signup") {
        res.writeHead(200, { "content-type": "text/html" }).end(SIGNUP);
      } else if (req.url === "/") {
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
