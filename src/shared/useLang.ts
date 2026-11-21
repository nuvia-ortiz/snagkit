import { useEffect, useState } from "react";
import { detectLang } from "./i18n";
import type { Lang } from "./types";

/** Idioma de la interfaz: el elegido por la persona o, si no eligió, el del navegador. */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(detectLang());

  useEffect(() => {
    chrome.storage.local.get("lang").then(({ lang: saved }) => {
      if (saved === "en" || saved === "es") setLangState(saved);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    void chrome.storage.local.set({ lang: l });
  };
  return [lang, setLang];
}
