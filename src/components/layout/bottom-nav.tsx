"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutGrid,
  Receipt,
  NotebookPen,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MoreSheet } from "@/components/layout/more-sheet";

// Mobile bottom bar: 4 links + More. Entry, theme, Vault Mode and the rest of
// the sections live in the More sheet.
const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app", label: "Calendar", icon: CalendarDays },
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/app/transactions", label: "Ledger", icon: Receipt },
  { href: "/app/journal", label: "Journal", icon: NotebookPen },
];

const MORE_ROUTES = ["/app/budgets", "/app/goals", "/app/bills", "/app/settings"];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = MORE_ROUTES.some((r) => pathname.startsWith(r));

  const tabClass = (active: boolean) =>
    cn(
      "relative flex h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors duration-200",
      active ? "text-amber" : "text-ink/45 hover:text-ink/75",
    );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 h-[var(--bottomnav-h)] border-t border-line bg-paper/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-full max-w-md items-center justify-between px-1">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {active && <span className="absolute top-1 h-0.5 w-7 rounded-full bg-amber" aria-hidden />}
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}

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
