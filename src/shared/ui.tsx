import type { Lang } from "./types";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#5eead4" />
      <circle cx="14" cy="14" r="6.5" fill="none" stroke="#09090b" strokeWidth="3" />
      <path d="M19 19l6 6" stroke="#09090b" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-line font-mono text-[11px]" role="group" aria-label="Language">
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          className={`px-2 py-1 uppercase transition ${lang === l ? "bg-accent text-bg" : "text-zinc-400 hover:text-zinc-100"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
