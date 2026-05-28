"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { UserMenu } from "@/components/features/user-menu";

export function Topbar() {
  const { openEntry } = useAppData();
  const today = new Date();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-ink/80 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex items-baseline gap-2">
        <span className="label">Today</span>
        <span className="font-mono text-sm text-white/70">{format(today, "EEE, MMM d, yyyy")}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => openEntry()}
          className="entry-btn inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-black shadow-entry transition-transform duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />
          Entry
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
