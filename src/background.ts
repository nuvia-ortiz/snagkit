// Service worker: guarda por pestaña lo que graban los content scripts y las peticiones
// de red fallidas, y crea los borradores de reporte. Nada sale del navegador.

import { parseBrowser, parseOs } from "./shared/report";
import { addEntry, addStep, emptySession } from "./shared/session";
import type { Environment, Message, NetworkEntry, ReportDraft, TabSession } from "./shared/types";

const key = (tabId: number) => `tab:${tabId}`;
const cache = new Map<number, TabSession>();
let queue: Promise<unknown> = Promise.resolve();

/** Las escrituras van en fila para que dos mensajes seguidos no se pisen. */
function update(tabId: number, change: (s: TabSession) => TabSession): Promise<void> {
  const run = queue.then(async () => {
    const current = await getSession(tabId);
    const next = change(current);
    if (next === current) return;
    cache.set(tabId, next);
    await chrome.storage.session.set({ [key(tabId)]: next });
  });
  queue = run.catch(() => {});
  return run;
}

async function getSession(tabId: number): Promise<TabSession> {
  const cached = cache.get(tabId);
  if (cached) return cached;
  const stored = (await chrome.storage.session.get(key(tabId)))[key(tabId)] as TabSession | undefined;
  const session = stored ?? emptySession();
  cache.set(tabId, session);
  return session;
}

async function clearSession(tabId: number) {
  await queue;
  cache.delete(tabId);
  await chrome.storage.session.remove(key(tabId));
}

// ── Red: peticiones con error HTTP o que no llegaron a completarse ─────────────
const FILTER: chrome.webRequest.RequestFilter = { urls: ["<all_urls>"] };

function isFromPage(d: { tabId: number; initiator?: string }) {
  return d.tabId >= 0 && !d.initiator?.startsWith("chrome-extension://");
}

chrome.webRequest.onCompleted.addListener((d) => {
  if (!isFromPage(d) || d.statusCode < 400) return;
  const entry: NetworkEntry = { t: Date.now(), method: d.method, url: d.url, status: d.statusCode, type: d.type };
  void update(d.tabId, (s) => addEntry(s, "network", entry));
}, FILTER);

chrome.webRequest.onErrorOccurred.addListener((d) => {
  // Las peticiones canceladas a propósito (navegar a otra página, abortar un fetch) no son fallos.
  if (!isFromPage(d) || d.error === "net::ERR_ABORTED") return;
  const entry: NetworkEntry = { t: Date.now(), method: d.method, url: d.url, status: 0, error: d.error, type: d.type };
  void update(d.tabId, (s) => addEntry(s, "network", entry));
}, FILTER);

// ── Mensajes ───────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  switch (message.type) {
    case "console":
      if (tabId !== undefined) void update(tabId, (s) => addEntry(s, "console", message.entry));
      return false;
    case "step":
      if (tabId !== undefined) void update(tabId, (s) => addStep(s, message.step));
      return false;
    case "getSession":
      void queue.then(() => getSession(message.tabId)).then(sendResponse);
      return true;
    case "clearSession":
      void clearSession(message.tabId).then(() => sendResponse(true));
      return true;
    case "createReport":
      createReport(message.tabId, message.windowId).then(
        (id) => sendResponse({ ok: true, id }),
        (error: unknown) => sendResponse({ ok: false, error: String(error) }),
      );
      return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => void clearSession(tabId));

// ── Reporte ───────────────────────────────────────────────────────────────────
function readPageEnvironment() {
  return {
    url: location.href,
    title: document.title,
    userAgent: navigator.userAgent,
    language: navigator.language,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${screen.width}×${screen.height}`,
    pixelRatio: window.devicePixelRatio,
  };
}

async function createReport(tabId: number, windowId: number): Promise<string> {
  const screenshot = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: readPageEnvironment });
  if (!result) throw new Error("No se pudo leer la página");

  const env: Environment = {
    ...result,
    browser: parseBrowser(result.userAgent),
    os: parseOs(result.userAgent),
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
  };

  await queue;
  const draft: ReportDraft = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    screenshot,
    env,
    session: await getSession(tabId),
  };

  await chrome.storage.local.set({ [`report:${draft.id}`]: draft });
  await pruneOldReports();
  await chrome.tabs.create({ url: chrome.runtime.getURL(`report/index.html?id=${draft.id}`), index: undefined });
  return draft.id;
}

/** Conserva solo los 20 borradores más recientes. */
async function pruneOldReports() {
  const all = await chrome.storage.local.get(null);
  const reports = Object.entries(all)
    .filter(([k]) => k.startsWith("report:"))
    .map(([k, v]) => ({ k, createdAt: (v as ReportDraft).createdAt }))
    .sort((a, b) => b.createdAt - a.createdAt);
  const old = reports.slice(20).map((r) => r.k);
  if (old.length) await chrome.storage.local.remove(old);
}
