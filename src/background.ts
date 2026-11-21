// Service worker: guarda por pestaña lo que graban los content scripts y las peticiones
// de red fallidas, y crea los borradores de reporte. Nada sale del navegador.

import { parseBrowser, parseOs } from "./shared/report";
import { addEntry, addStep, emptySession } from "./shared/session";
import type { Environment, Message, NetworkEntry, Prefill, Rect, ReportDraft, TabSession } from "./shared/types";

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

// ── Grabación: encendida o en pausa ───────────────────────────────────────────
// En pausa no se inyecta nada en las páginas ni se guarda nada. Encendida, se queda
// así (también tras reiniciar el navegador) hasta que la persona la pausa.

const SCRIPTS: chrome.scripting.RegisteredContentScript[] = [
  { id: "page-hooks", js: ["page-hooks.js"], matches: ["<all_urls>"], runAt: "document_start", world: "MAIN" },
  { id: "recorder", js: ["recorder.js"], matches: ["<all_urls>"], runAt: "document_start" },
];

let recording = false;
const ready = chrome.storage.local.get("recording").then(({ recording: saved }) => {
  recording = saved === true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.recording) recording = changes.recording.newValue === true;
});

async function showBadge(on: boolean) {
  await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  await chrome.action.setBadgeTextColor?.({ color: "#ffffff" });
  await chrome.action.setBadgeText({ text: on ? "REC" : "" });
}

/** Deja los content scripts registrados solo si la grabación está encendida. */
async function syncScripts(on: boolean) {
  const existing = await chrome.scripting.getRegisteredContentScripts();
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) });
  if (on) await chrome.scripting.registerContentScripts(SCRIPTS);
}

/** Al encender, las pestañas que ya estaban abiertas empiezan a grabar sin tener que recargarlas. */
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return;
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["page-hooks.js"], world: "MAIN" });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["recorder.js"] });
      } catch {
        // páginas protegidas (Chrome Web Store, visor de PDF…): se ignoran
      }
    }),
  );
}

async function setRecording(on: boolean) {
  await chrome.storage.local.set({ recording: on });
  recording = on;
  await syncScripts(on);
  await showBadge(on);
  if (on) await injectIntoOpenTabs();
}

// Al instalar o actualizar la extensión se reconstruye el estado guardado.
chrome.runtime.onInstalled.addListener(async () => {
  await ready;
  await syncScripts(recording);
  await showBadge(recording);
});
chrome.runtime.onStartup.addListener(async () => {
  await ready;
  await showBadge(recording);
});

// ── Red: peticiones con error HTTP o que no llegaron a completarse ─────────────
const FILTER: chrome.webRequest.RequestFilter = { urls: ["<all_urls>"] };

function isFromPage(d: { tabId: number; initiator?: string }) {
  return recording && d.tabId >= 0 && !d.initiator?.startsWith("chrome-extension://");
}

// El service worker puede despertar justo por una petición: se espera a saber si se graba.
chrome.webRequest.onCompleted.addListener(async (d) => {
  await ready;
  if (!isFromPage(d) || d.statusCode < 400) return;
  const entry: NetworkEntry = { t: Date.now(), method: d.method, url: d.url, status: d.statusCode, type: d.type };
  void update(d.tabId, (s) => addEntry(s, "network", entry));
}, FILTER);

chrome.webRequest.onErrorOccurred.addListener(async (d) => {
  await ready;
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
      if (tabId !== undefined) void ready.then(() => (recording ? update(tabId, (s) => addEntry(s, "console", message.entry)) : undefined));
      return false;
    case "step":
      if (tabId !== undefined) void ready.then(() => (recording ? update(tabId, (s) => addStep(s, message.step)) : undefined));
      return false;
    case "reportFromPage":
      if (tabId === undefined || sender.tab?.windowId === undefined) return false;
      createReport(tabId, sender.tab.windowId, { prefill: message.prefill, highlight: message.highlight }).then(
        (id) => sendResponse({ ok: true, id }),
        (error: unknown) => sendResponse({ ok: false, error: String(error) }),
      );
      return true;
    case "runFormTester":
      chrome.scripting.executeScript({ target: { tabId: message.tabId }, files: ["form-tester.js"] }).then(
        () => sendResponse({ ok: true }),
        (error: unknown) => sendResponse({ ok: false, error: String(error) }),
      );
      return true;
    case "setRecording":
      setRecording(message.on).then(
        () => sendResponse(true),
        (error: unknown) => sendResponse({ error: String(error) }),
      );
      return true;
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

async function createReport(tabId: number, windowId: number, extra: { prefill?: Prefill; highlight?: Rect } = {}): Promise<string> {
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
    prefill: extra.prefill,
    // El recuadro llega en píxeles CSS; la captura está en píxeles físicos.
    highlight: extra.highlight && {
      x: extra.highlight.x * result.pixelRatio,
      y: extra.highlight.y * result.pixelRatio,
      w: extra.highlight.w * result.pixelRatio,
      h: extra.highlight.h * result.pixelRatio,
    },
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
