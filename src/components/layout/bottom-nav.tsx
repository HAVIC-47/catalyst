"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutGrid, Receipt, NotebookPen, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Five top-level sections in the mobile bottom bar. Other sections (Budgets,
// Goals, Bills) live in Dashboard quick links / Settings — kept off the bar to
// stay legible on small screens.
const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app", label: "Calendar", icon: CalendarDays },
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/app/transactions", label: "Tx", icon: Receipt },
  { href: "/app/journal", label: "Journal", icon: NotebookPen },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/80 backdrop-blur-xl lg:hidden"
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
                  active ? "text-amber" : "text-white/45 hover:text-white/75",
                )}
              >
                {active && (
                  <span className="absolute top-1 h-0.5 w-7 rounded-full bg-amber" aria-hidden />
                )}
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
