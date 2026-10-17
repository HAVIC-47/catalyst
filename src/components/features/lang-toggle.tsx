"use client";

// The language on pages outside the app (login, sign-up, password reset): what
// this browser chose last, and a one-tap English / বাংলা switch. Inside the app
// the account's own setting (Settings → Language) takes over.
import { useEffect, useState } from "react";
import { rememberLang, setLang, storedLang, type Lang } from "@/lib/i18n";

/** The browser's language, applied after the first paint (so it matches the server's HTML first). */
export function useStoredLang(): [Lang, (l: Lang) => void] {
  const [lang, setState] = useState<Lang>("en");
  useEffect(() => {
    const l = storedLang();
    setLang(l);
    setState(l);
  }, []);
  const change = (l: Lang) => {
    setLang(l);
    rememberLang(l);
    setState(l);
  };
  return [lang, change];
}

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(lang === "bn" ? "en" : "bn")}
      lang={lang === "bn" ? "en" : "bn"}
      className="inline-flex min-h-[36px] cursor-pointer items-center rounded-lg border border-line px-3 text-xs font-medium text-ink/65 transition-colors hover:bg-ink/[0.04] hover:text-ink"
    >
      {lang === "bn" ? "English" : "বাংলা"}
    </button>
  );
}
