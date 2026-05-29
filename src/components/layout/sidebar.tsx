"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutGrid,
  Receipt,
  PiggyBank,
  Target,
  Bell,
  NotebookPen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app", label: "Calendar", icon: CalendarDays },
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/app/transactions", label: "Transactions", icon: Receipt },
  { href: "/app/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/app/goals", label: "Goals", icon: Target },
  { href: "/app/bills", label: "Bills", icon: Bell },
  { href: "/app/journal", label: "Journal", icon: NotebookPen },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-5 lg:flex">
      <Link href="/app" className="mb-7 flex items-baseline gap-2 px-3">
        <span className="font-display text-2xl font-semibold tracking-tight text-ink">
          Catalyst
        </span>
        <span className="label text-amber/70">৳ BD</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200",
                active ? "bg-ink/[0.06] text-ink" : "text-ink/50 hover:bg-ink/[0.03] hover:text-ink/80",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-amber" />
              )}
              <Icon className={cn("h-[18px] w-[18px]", active && "text-amber")} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center justify-between px-3">
        <span className="label">v0.2</span>
        <span className="label text-ink/30">৳ BDT</span>
      </div>
    </aside>
  );
}
