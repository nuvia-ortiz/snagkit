import { dictionaries } from "./i18n";
import { redactUrl, truncate } from "./redact";
import type { ConsoleEntry, Environment, Lang, NetworkEntry, ReportDraft, ReportForm } from "./types";

/** Nombre y versión del navegador a partir del user agent. */
export function parseBrowser(ua: string): string {
  const rules: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
  ];
  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1].split(".")[0]}`;
  }
  return "Unknown";
}

export function parseOs(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows/.test(ua)) return "Windows";
  if (/Android ([\d.]+)/.test(ua)) return `Android ${ua.match(/Android ([\d.]+)/)![1]}`;
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function time(t: number): string {
  return new Date(t).toISOString().slice(11, 19);
}

function consoleLines(entries: ConsoleEntry[]): string[] {
  return entries.map((e) => `[${time(e.t)}] ${e.level.toUpperCase()} ${truncate(e.message, 300)}${e.source ? ` (${redactUrl(e.source)})` : ""}`);
}

function networkLines(entries: NetworkEntry[]): string[] {
  return entries.map((n) => {
    const status = n.status > 0 ? String(n.status) : (n.error ?? "failed");
    return `[${time(n.t)}] ${n.method} ${status} ${truncate(redactUrl(n.url), 200)}`;
  });
}

function envRows(env: Environment, lang: Lang): [string, string][] {
  const md = dictionaries[lang].md;
  return [
    [md.url, redactUrl(env.url)],
    [md.browser, env.browser],
    [md.os, env.os],
    [md.viewport, env.viewport],
    [md.screen, `${env.screen} @${env.pixelRatio}x`],
    [md.language, env.language],
    [md.time, env.timestamp],
  ];
}

type Parts = { draft: ReportDraft; form: ReportForm; lang: Lang };

/** Reporte en Markdown, listo para GitHub, GitLab, Linear, Notion o Slack. */
export function toMarkdown({ draft, form, lang }: Parts): string {
  const d = dictionaries[lang];
  const md = d.md;
  const out: string[] = [];

  out.push(`## ${form.title.trim() || md.untitled}`, "");
  out.push(`**${md.severity}:** ${d.severities[form.severity]}`, "");

  if (form.description.trim()) out.push(`### ${md.description}`, form.description.trim(), "");
  if (form.steps.trim()) out.push(`### ${md.steps}`, form.steps.trim(), "");
  if (form.expected.trim()) out.push(`### ${md.expected}`, form.expected.trim(), "");

  out.push(`### ${md.screenshot}`, md.screenshotNote, "");

  if (form.include.env) {
    out.push(`### ${md.env}`, "| | |", "|---|---|");
    for (const [k, v] of envRows(draft.env, lang)) out.push(`| ${k} | ${v.replaceAll("|", "\\|")} |`);
    out.push("");
  }

  const cons = draft.session.console;
  if (form.include.console && cons.length > 0) {
    out.push(`<details><summary>${md.console} (${cons.length})</summary>`, "", "```", ...consoleLines(cons), "```", "", "</details>", "");
  }

  const net = draft.session.network;
  if (form.include.network && net.length > 0) {
    out.push(`<details><summary>${md.network} (${net.length})</summary>`, "", "```", ...networkLines(net), "```", "", "</details>", "");
  }

  out.push("---", `<sub>${md.footer}</sub>`);
  return out.join("\n");
}

/** Reporte con el formato de texto de Jira (wiki markup). */
export function toJira({ draft, form, lang }: Parts): string {
  const d = dictionaries[lang];
  const md = d.md;
  const out: string[] = [];

  out.push(`h2. ${form.title.trim() || md.untitled}`, "");
  out.push(`*${md.severity}:* ${d.severities[form.severity]}`, "");

  if (form.description.trim()) out.push(`h3. ${md.description}`, form.description.trim(), "");
  if (form.steps.trim()) {
    const steps = form.steps
      .trim()
      .split("\n")
      .map((l) => `# ${l.replace(/^\s*\d+[.)]\s*/, "")}`);
    out.push(`h3. ${md.steps}`, ...steps, "");
  }
  if (form.expected.trim()) out.push(`h3. ${md.expected}`, form.expected.trim(), "");

  if (form.include.env) {
    out.push(`h3. ${md.env}`);
    for (const [k, v] of envRows(draft.env, lang)) out.push(`||${k}|${v.replaceAll("|", "\\|")}|`);
    out.push("");
  }

  const cons = draft.session.console;
  if (form.include.console && cons.length > 0) out.push(`h3. ${md.console}`, "{noformat}", ...consoleLines(cons), "{noformat}", "");

  const net = draft.session.network;
  if (form.include.network && net.length > 0) out.push(`h3. ${md.network}`, "{noformat}", ...networkLines(net), "{noformat}", "");

  out.push(`_${md.footer}_`);
  return out.join("\n");
}

const GITHUB_URL_LIMIT = 7500;

/** Enlace que abre una issue nueva en GitHub con el título y el texto ya escritos. */
export function githubIssueUrl(repo: string, title: string, body: string): { url: string; truncated: boolean } | null {
  const clean = repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) return null;
  const base = `https://github.com/${clean}/issues/new`;
  const build = (b: string) => `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(b)}`;
  let url = build(body);
  if (url.length <= GITHUB_URL_LIMIT) return { url, truncated: false };
  let cut = body;
  while (url.length > GITHUB_URL_LIMIT && cut.length > 0) {
    cut = cut.slice(0, Math.floor(cut.length * 0.8));
    url = build(`${cut}\n\n…`);
  }
  return { url, truncated: true };
}
