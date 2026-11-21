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

export function Popup() {
  const [lang, setLang] = useLang();
  const t = dictionaries[lang];
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [session, setSession] = useState<TabSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

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
  }, [load]);

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

  return (
    <main className="w-[340px] p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <div>
            <h1 className="text-sm font-semibold leading-none text-zinc-50">Snagkit</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{t.tagline}</p>
          </div>
        </div>
        <LangToggle lang={lang} onChange={setLang} />
      </header>

      {!supported ? (
        <p className="rounded-lg border border-line bg-panel p-3 text-sm text-zinc-400">{t.unsupported}</p>
      ) : (
        <>
          <p className="mb-2 truncate font-mono text-[11px] text-zinc-500" title={tab?.url}>
            {host}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t.consoleErrors} value={session?.console.filter((c) => c.level === "error").length ?? 0} tone="danger" />
            <Stat label={t.failedRequests} value={session?.network.length ?? 0} tone="warn" />
            <Stat label={t.steps} value={session?.steps.length ?? 0} tone="accent" />
          </div>

          {session && session.steps.length === 0 && <p className="mt-3 text-xs text-warn">{t.reloadHint}</p>}

          <button
            type="button"
            onClick={report}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:brightness-110 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 016 0v1.1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.5 13H3M21 13h-3.5M7 18l-2.5 2.5M17 18l2.5 2.5M7 9L4.5 6.5M17 9l2.5-2.5" />
            </svg>
            {busy ? t.capturing : t.reportBug}
          </button>
          <button type="button" onClick={clear} className="mt-2 w-full rounded-lg px-4 py-2 text-xs text-zinc-400 transition hover:bg-panel hover:text-zinc-100">
            {t.clear}
          </button>
          {notice && (
            <p role="status" className="mt-1 text-center text-xs text-zinc-400">
              {notice}
            </p>
          )}
        </>
      )}

      <section className="mt-4 border-t border-line pt-3">
        <h2 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{t.modules}</h2>
        {[t.forms, t.stress].map((name) => (
          <div key={name} className="flex items-center justify-between py-1.5 text-sm text-zinc-500">
            <span>{name}</span>
            <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase">{t.soon}</span>
          </div>
        ))}
      </section>

      <p className="mt-3 text-center text-[11px] text-zinc-600">🔒 {t.local}</p>
    </main>
  );
}
