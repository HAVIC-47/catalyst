"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

// Browser-chrome color per theme (paper color); keep in sync with the root layout.
const THEME_COLOR = { light: "#F8F7FC", dark: "#000000" };

// Toggles the `dark` class on <html> and persists the choice. The no-flash script
// in the root layout applies the saved/system theme before first paint.
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next ? THEME_COLOR.dark : THEME_COLOR.light);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={mounted && dark ? tr("Switch to light mode") : tr("Switch to dark mode")}
      title={tr("Toggle theme")}
      className={cn(
        "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-line text-ink/60 transition-colors duration-200 hover:bg-ink/[0.05] hover:text-ink",
        className,
      )}
    >
      {mounted && dark ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
