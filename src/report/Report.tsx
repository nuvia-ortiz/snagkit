import { useEffect, useMemo, useRef, useState } from "react";
import { dictionaries, stepsToText } from "../shared/i18n";
import { redactUrl } from "../shared/redact";
import { githubIssueUrl, toJira, toMarkdown } from "../shared/report";
import type { ReportDraft, ReportForm, Severity } from "../shared/types";
import { LangToggle, Logo } from "../shared/ui";
import { useLang } from "../shared/useLang";
import { Annotator, type AnnotatorApi } from "./Annotator";

const field = "w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none";
const button = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-accent hover:text-accent disabled:opacity-40";

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

function fileStamp(draft: ReportDraft) {
  return new Date(draft.createdAt).toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

export function Report() {
  const [lang, setLang] = useLang();
  const t = dictionaries[lang];
  const id = new URLSearchParams(location.search).get("id");
  const [draft, setDraft] = useState<ReportDraft | null | undefined>(undefined);
  const [stepsEdited, setStepsEdited] = useState(false);
  const [repo, setRepo] = useState("");
  const [toast, setToast] = useState("");
  const annotator = useRef<AnnotatorApi>(null);

  const [form, setForm] = useState<ReportForm>({
    title: "",
    severity: "medium",
    description: "",
    expected: "",
    steps: "",
    include: { env: true, console: true, network: true },
  });

  useEffect(() => {
    if (!id) return setDraft(null);
    chrome.storage.local.get([`report:${id}`, "githubRepo"]).then((data) => {
      setDraft((data[`report:${id}`] as ReportDraft | undefined) ?? null);
      if (typeof data.githubRepo === "string") setRepo(data.githubRepo);
    });
  }, [id]);

  // Mientras la persona no edite los pasos, se regeneran en el idioma elegido.
  useEffect(() => {
    if (draft && !stepsEdited) setForm((f) => ({ ...f, steps: stepsToText(draft.session.steps, lang) }));
  }, [draft, lang, stepsEdited]);

  const parts = useMemo(() => (draft ? { draft, form, lang } : null), [draft, form, lang]);
  const markdown = useMemo(() => (parts ? toMarkdown(parts) : ""), [parts]);

  if (draft === undefined) return null;
  if (draft === null)
    return (
      <main className="mx-auto max-w-xl p-10 text-center text-zinc-400">
        <Logo size={40} />
        <p className="mt-4">{t.notFound}</p>
      </main>
    );

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2500);
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    notify(t.copied);
  };

  const copyImage = async () => {
    const blob = await annotator.current!.toBlob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    notify(t.copied);
  };

  const openGithub = async () => {
    await chrome.storage.local.set({ githubRepo: repo });
    const result = githubIssueUrl(repo, form.title.trim() || t.md.untitled, markdown);
    if (!result) return;
    await copyImage();
    notify(result.truncated ? t.tooLong : t.githubHint);
    window.open(result.url, "_blank", "noopener");
  };

  const set = <K extends keyof ReportForm>(key: K, value: ReportForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = draft.session.console;
  const network = draft.session.network;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-zinc-50">{t.reportTitle}</h1>
              <p className="truncate font-mono text-[11px] text-zinc-500">{redactUrl(draft.env.url)}</p>
            </div>
          </div>
          <LangToggle lang={lang} onChange={setLang} />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border border-line bg-panel/40 p-4">
            <Annotator ref={annotator} src={draft.screenshot} labels={{ tools: t.tools, undo: t.undo, clearMarks: t.clearMarks, screenshot: t.screenshot }} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <LogPanel
              title={t.md.console}
              empty={t.noData}
              lines={errors.map((e) => ({ tone: e.level === "error" ? "text-danger" : "text-warn", head: e.level.toUpperCase(), body: e.message }))}
            />
            <LogPanel
              title={t.md.network}
              empty={t.noData}
              lines={network.map((n) => ({ tone: "text-warn", head: n.status > 0 ? `${n.method} ${n.status}` : `${n.method} ✕`, body: redactUrl(n.url) }))}
            />
          </section>
        </div>

        <aside className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.title}</span>
            <input className={field} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t.titlePlaceholder} autoFocus />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-zinc-400">{t.severity}</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={form.severity === s}
                  onClick={() => set("severity", s)}
                  className={`rounded-lg border px-2 py-1.5 text-xs transition ${form.severity === s ? "border-accent bg-accent/10 text-accent" : "border-line text-zinc-400 hover:text-zinc-100"}`}
                >
                  {t.severities[s]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.description}</span>
            <textarea className={`${field} min-h-20`} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.stepsLabel}</span>
            <textarea
              className={`${field} min-h-36 font-mono text-xs`}
              value={form.steps}
              onChange={(e) => {
                setStepsEdited(true);
                set("steps", e.target.value);
              }}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">{t.expected}</span>
            <textarea className={`${field} min-h-16`} value={form.expected} onChange={(e) => set("expected", e.target.value)} />
          </label>

          <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
            <legend className="mb-1.5 text-xs font-medium text-zinc-400">{t.include}</legend>
            {(
              [
                ["env", `${t.envShort}`],
                ["console", `${t.md.console} (${errors.length})`],
                ["network", `${t.md.network} (${network.length})`],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" className="accent-accent" checked={form.include[k]} onChange={(e) => set("include", { ...form.include, [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </fieldset>

          <div className="space-y-2 rounded-xl border border-line bg-panel/40 p-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={button} onClick={() => copyText(markdown)}>
                {t.copyMarkdown}
              </button>
              <button type="button" className={button} onClick={() => copyText(toJira(parts!))}>
                {t.copyJira}
              </button>
              <button type="button" className={button} onClick={copyImage}>
                {t.copyImage}
              </button>
              <button type="button" className={button} onClick={() => download(annotator.current!.toDataUrl(), `snagkit-${fileStamp(draft)}.png`)}>
                {t.downloadImage}
              </button>
            </div>
            <button
              type="button"
              className={`${button} w-full`}
              onClick={() => download(URL.createObjectURL(new Blob([markdown], { type: "text/markdown" })), `snagkit-${fileStamp(draft)}.md`)}
            >
              {t.downloadMd}
            </button>
            <div className="border-t border-line pt-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-zinc-500">{t.githubRepo}</span>
                <div className="flex gap-2">
                  <input className={`${field} py-1.5 font-mono text-xs`} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" />
                  <button type="button" className={`${button} shrink-0`} onClick={openGithub} disabled={!githubIssueUrl(repo, "x", "x")}>
                    {t.openGithub}
                  </button>
                </div>
              </label>
            </div>
          </div>

          <details className="rounded-xl border border-line bg-panel/40">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400">{t.output} · Markdown</summary>
            <pre data-testid="markdown" className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-line p-3 font-mono text-[11px] text-zinc-300">
              {markdown}
            </pre>
          </details>
        </aside>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 max-w-[90vw] -translate-x-1/2 rounded-lg border border-accent/40 bg-panel px-4 py-2 text-sm text-zinc-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function LogPanel({ title, empty, lines }: { title: string; empty: string; lines: { tone: string; head: string; body: string }[] }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-panel/40">
      <h2 className="border-b border-line px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
        {title} <span className="text-zinc-600">({lines.length})</span>
      </h2>
      {lines.length === 0 ? (
        <p className="px-3 py-4 text-xs text-zinc-600">{empty}</p>
      ) : (
        <ul className="max-h-60 overflow-auto font-mono text-[11px]">
          {lines.map((l, i) => (
            <li key={i} className="border-b border-line/60 px-3 py-1.5 last:border-0">
              <span className={`${l.tone} mr-2`}>{l.head}</span>
              <span className="break-all text-zinc-300">{l.body}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
