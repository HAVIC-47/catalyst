"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutGrid, Receipt, MoreHorizontal, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppData } from "@/hooks/use-app-data";
import { MORE_NAV, MoreSheet } from "@/components/layout/more-sheet";

// Mobile bottom bar: Calendar · Dashboard · + · Ledger · More. The center + scans
// a memo or notes — or, on the To-do / To buy pages, a screenshot of a list that
// becomes tickets. Journal, boards, the rest of the sections, new entry, theme
// and Vault Mode live in the More sheet.
type Tab = { href: string; label: string; icon: LucideIcon };
const CALENDAR: Tab = { href: "/app", label: "Calendar", icon: CalendarDays };
const DASHBOARD: Tab = { href: "/app/dashboard", label: "Dashboard", icon: LayoutGrid };
const LEDGER: Tab = { href: "/app/transactions", label: "Ledger", icon: Receipt };

export function BottomNav() {
  const pathname = usePathname();
  const { openMemo, openListScan } = useAppData();
  const [moreOpen, setMoreOpen] = useState(false);
  const boardKind = pathname.startsWith("/app/todo") ? "todo" : pathname.startsWith("/app/shopping") ? "shopping" : null;

  const moreActive = MORE_NAV.some(({ href }) => pathname.startsWith(href));

  const tabClass = (active: boolean) =>
    cn(
      "relative flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors duration-200",
      active ? "text-amber" : "text-ink/45 hover:text-ink/75",
    );

  const tab = ({ href, label, icon: Icon }: Tab) => {
    const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
        {active && <span className="absolute top-1 h-0.5 w-7 rounded-full bg-amber" aria-hidden />}
        <Icon className="h-[18px] w-[18px]" aria-hidden />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 h-[var(--bottomnav-h)] border-t border-line bg-paper/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-full max-w-md items-center justify-between px-1">
          {tab(CALENDAR)}
          {tab(DASHBOARD)}

          {/* The center action: scan a memo or notes, or a list on the board pages. */}
          <div className="flex flex-1 items-center justify-center">
            <button
              onClick={() => (boardKind ? openListScan(boardKind) : openMemo())}
              aria-label={boardKind ? "Add from a screenshot of your list" : "Scan a memo or notes"}
              className="entry-btn flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-paper shadow-entry transition-transform duration-200 focus-visible:rounded-full! active:scale-95"
            >
              <Plus className="h-6 w-6" aria-hidden strokeWidth={2.5} />
            </button>
          </div>

          {tab(LEDGER)}

          <button onClick={() => setMoreOpen(true)} aria-label="More sections" className={tabClass(moreActive)}>
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
