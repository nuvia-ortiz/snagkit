import { useCallback, useEffect, useState } from "react";
import { dictionaries } from "../shared/i18n";
import type { Message, TabSession } from "../shared/types";
import { LangToggle, Logo } from "../shared/ui";
import { useLang } from "../shared/useLang";

function send<T>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "danger" | "warn" | "accent" }) {
  const color = value === 0 ? "text-zinc-500" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-accent";
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
      <div className={`font-mono text-xl font-semibold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-zinc-400">{label}</div>
    </div>
  );
}

type Tool = "bugs" | "forms" | "stress";

export function Popup() {
  const [lang, setLang] = useLang();
  const t = dictionaries[lang];
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [session, setSession] = useState<TabSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState<boolean | null>(null);
  const [tool, setTool] = useState<Tool>("bugs");

  const supported = !!tab?.url && /^(https?|file):/.test(tab.url);

  const load = useCallback(async (current: chrome.tabs.Tab) => {
    if (current.id === undefined) return;
    setSession(await send<TabSession>({ type: "getSession", tabId: current.id }));
  }, []);

  useEffect(() => {
    // ?tabId= permite abrir el popup como página normal apuntando a otra pestaña (lo usan los tests end-to-end).
    const forced = Number(new URLSearchParams(location.search).get("tabId"));
    const pick = forced ? chrome.tabs.get(forced) : chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => t);
    pick.then((current) => {
      setTab(current ?? null);
      if (current) void load(current);
    });
    chrome.storage.local.get(["recording", "tool"]).then(({ recording: on, tool: saved }) => {
      setRecording(on === true);
      if (saved === "bugs" || saved === "forms" || saved === "stress") setTool(saved);
    });
  }, [load]);

  // Contadores en vivo mientras el popup está abierto.
  useEffect(() => {
    if (!tab || !recording) return;
    const timer = window.setInterval(() => void load(tab), 1000);
    return () => window.clearInterval(timer);
  }, [tab, recording, load]);

  const chooseTool = (next: Tool) => {
    setTool(next);
    setNotice("");
    void chrome.storage.local.set({ tool: next });
  };

  const toggleRecording = async () => {
    const on = !recording;
    setRecording(on);
    setNotice("");
    await send({ type: "setRecording", on });
    if (tab) window.setTimeout(() => void load(tab), 300);
  };

  const report = async () => {
    if (!tab?.id || tab.windowId === undefined) return;
    setBusy(true);
    const res = await send<{ ok: boolean; error?: string }>({ type: "createReport", tabId: tab.id, windowId: tab.windowId });
    if (res.ok) window.close();
    else {
      setBusy(false);
      setNotice(res.error ?? "Error");
    }
  };

  const runTool = async (type: "runFormTester" | "runStressTest") => {
    if (!tab?.id) return;
    const res = await send<{ ok: boolean; error?: string }>({ type, tabId: tab.id });
    if (res.ok) window.close();
    else setNotice(res.error ?? "Error");
  };

  const clear = async () => {
    if (!tab?.id) return;
    await send({ type: "clearSession", tabId: tab.id });
    await load(tab);
    setNotice(t.cleared);
  };

  const host = (() => {
    try {
      return tab?.url ? new URL(tab.url).host || tab.url : "";
    } catch {
      return "";
    }
  })();

  const toolButton =
    "flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-50";

  const tabs: { id: Tool; label: string; icon: string }[] = [
    { id: "bugs", label: t.tabBugs, icon: "🐞" },
    { id: "forms", label: t.tabForms, icon: "📝" },
    { id: "stress", label: t.tabStress, icon: "💥" },
  ];

  const checklist = (items: string[]) => (
    <ul className="mt-2 space-y-1 text-xs text-zinc-400">
      {items.map((c) => (
        <li key={c} className="flex gap-2">
          <span className="text-accent" aria-hidden>
            ✓
          </span>
          {c}
        </li>
      ))}
    </ul>
  );

  return (
    <main className="w-[340px] p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <div>
            <h1 className="text-sm font-semibold leading-none text-zinc-50">Snagkit</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{t.tagline}</p>
          </div>
        </div>
        <LangToggle lang={lang} onChange={setLang} />
      </header>

      <div role="tablist" aria-label={t.modules} className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-line bg-panel p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tool === item.id}
            aria-controls="tool-panel"
            onClick={() => chooseTool(item.id)}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${tool === item.id ? "bg-accent text-bg" : "text-zinc-400 hover:text-zinc-100"}`}
          >
            <span aria-hidden>{item.icon}</span> {item.label}
          </button>
        ))}
      </div>

      {!supported ? (
        <p className="rounded-lg border border-line bg-panel p-3 text-sm text-zinc-400">{t.unsupported}</p>
      ) : (
        <div id="tool-panel" role="tabpanel" aria-labelledby={`tab-${tool}`}>
          <p className="mb-2 truncate font-mono text-[11px] text-zinc-500" title={tab?.url}>
            {host}
          </p>

          {tool === "bugs" && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm" role="status">
                  <span className="relative flex h-2.5 w-2.5">
                    {recording && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:hidden" />}
                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${recording ? "bg-red-500" : "bg-zinc-600"}`} />
                  </span>
                  <span className={recording ? "font-medium text-zinc-100" : "text-zinc-400"}>{recording ? t.recordingOn : t.recordingOff}</span>
                </span>
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={recording === null}
                  aria-pressed={!!recording}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    recording ? "border border-line text-zinc-200 hover:border-zinc-500" : "bg-red-500 text-white hover:bg-red-400"
                  }`}
                >
                  {recording ? `❚❚ ${t.pause}` : `● ${t.start}`}
                </button>
              </div>
              {recording !== null && <p className="mt-2 text-xs leading-relaxed text-zinc-500">{recording ? t.recordingHint : t.pausedHint}</p>}

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label={t.consoleErrors} value={session?.console.filter((c) => c.level === "error").length ?? 0} tone="danger" />
                <Stat label={t.failedRequests} value={session?.network.length ?? 0} tone="warn" />
                <Stat label={t.steps} value={session?.steps.length ?? 0} tone="accent" />
              </div>

              <button type="button" onClick={report} disabled={busy} className={`${toolButton} mt-3`}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 016 0v1.1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.5 13H3M21 13h-3.5M7 18l-2.5 2.5M17 18l2.5 2.5M7 9L4.5 6.5M17 9l2.5-2.5" />
                </svg>
                {busy ? t.capturing : t.reportBug}
              </button>
              <button type="button" onClick={clear} className="mt-2 w-full rounded-lg px-4 py-2 text-xs text-zinc-400 transition hover:bg-panel hover:text-zinc-100">
                {t.clear}
              </button>
            </>
          )}

          {tool === "forms" && (
            <>
              <h2 className="text-sm font-semibold text-zinc-100">{t.forms}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{t.formsLong}</p>
              {checklist(t.formsChecks)}
              <button type="button" onClick={() => runTool("runFormTester")} className={`${toolButton} mt-4`}>
                {t.runForms}
              </button>
            </>
          )}

          {tool === "stress" && (
            <>
              <h2 className="text-sm font-semibold text-zinc-100">{t.stress}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{t.stressLong}</p>
              {checklist(t.stressChecks)}
              <button type="button" onClick={() => runTool("runStressTest")} className={`${toolButton} mt-4`}>
                {t.runStress}
              </button>
            </>
          )}

          {notice && (
            <p role="status" className="mt-2 text-center text-xs text-zinc-400">
              {notice}
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-zinc-600">🔒 {t.local}</p>
    </main>
  );
}
