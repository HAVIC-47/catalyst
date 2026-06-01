"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutGrid,
  Receipt,
  NotebookPen,
  Plus,
  Sun,
  Moon,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppData } from "@/hooks/use-app-data";
import { MoreSheet } from "@/components/layout/more-sheet";

// Mobile bottom bar: 3 links · Entry (center) · 3 actions.
const LEFT: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app", label: "Calendar", icon: CalendarDays },
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/app/transactions", label: "Ledger", icon: Receipt },
];

const MORE_ROUTES = ["/app/budgets", "/app/goals", "/app/bills", "/app/settings"];

export function BottomNav() {
  const pathname = usePathname();
  const { openEntry } = useAppData();
  const [moreOpen, setMoreOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  };

  const moreActive = MORE_ROUTES.some((r) => pathname.startsWith(r));

  const tabClass = (active: boolean) =>
    cn(
      "relative flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors duration-200",
      active ? "text-amber" : "text-ink/45 hover:text-ink/75",
    );

  const NavLink = ({ href, label, icon: Icon }: (typeof LEFT)[number]) => {
    const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
        {active && <span className="absolute top-1 h-0.5 w-7 rounded-full bg-amber" aria-hidden />}
        <Icon className="h-[18px] w-[18px]" aria-hidden />
        <span>{label}</span>
      </Link>
    );
  };

  const journalActive = pathname.startsWith("/app/journal");

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-between px-1 py-1.5">
          {/* 3 left */}
          {LEFT.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          {/* Entry — prominent center action */}
          <div className="flex flex-1 items-center justify-center">
            <button
              onClick={() => openEntry()}
              aria-label="New entry"
              className="entry-btn flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-paper shadow-entry active:scale-95"
            >
              <Plus className="h-5 w-5" aria-hidden strokeWidth={2.5} />
            </button>
          </div>

          {/* 3 right: Journal · Theme · More */}
          <Link
            href="/app/journal"
            aria-current={journalActive ? "page" : undefined}
            className={tabClass(journalActive)}
          >
            {journalActive && <span className="absolute top-1 h-0.5 w-7 rounded-full bg-amber" aria-hidden />}
            <NotebookPen className="h-[18px] w-[18px]" aria-hidden />
            <span>Journal</span>
          </Link>

          <button
            onClick={toggleTheme}
            aria-label={mounted && dark ? "Light mode" : "Dark mode"}
            className={tabClass(false)}
          >
            {mounted && dark ? (
              <Sun className="h-[18px] w-[18px]" aria-hidden />
            ) : (
              <Moon className="h-[18px] w-[18px]" aria-hidden />
            )}
            <span>Theme</span>
          </button>

          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More sections"
            className={tabClass(moreActive)}
          >
            {moreActive && <span className="absolute top-1 h-0.5 w-7 rounded-full bg-amber" aria-hidden />}
            <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
            <span>More</span>
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
