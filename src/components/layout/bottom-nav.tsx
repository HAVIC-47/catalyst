"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutGrid, Receipt, NotebookPen, MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoreSheet } from "@/components/layout/more-sheet";

// Four core sections + a "More" button that opens a sheet with everything else
// (Budgets, Goals, Bills, Settings) plus theme toggle and sign out.
const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app", label: "Calendar", icon: CalendarDays },
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/app/transactions", label: "Ledger", icon: Receipt },
  { href: "/app/journal", label: "Journal", icon: NotebookPen },
];

// Routes reachable only from the More sheet — keep the More tab lit when on them.
const MORE_ROUTES = ["/app/budgets", "/app/goals", "/app/bills", "/app/settings"];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors duration-200",
                    active ? "text-amber" : "text-ink/45 hover:text-ink/75",
                  )}
                >
                  {active && <span className="absolute top-1 h-0.5 w-7 rounded-full bg-amber" aria-hidden />}
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              aria-label="More sections"
              className={cn(
                "relative flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors duration-200",
                moreActive ? "text-amber" : "text-ink/45 hover:text-ink/75",
              )}
            >
              {moreActive && <span className="absolute top-1 h-0.5 w-7 rounded-full bg-amber" aria-hidden />}
              <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
