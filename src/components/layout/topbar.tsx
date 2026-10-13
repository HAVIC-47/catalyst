"use client";

import { format } from "date-fns";
import { Camera, Plus } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { UserMenu } from "@/components/features/user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { VaultModeToggle } from "@/components/features/vault-mode-toggle";

export function Topbar() {
  const { openEntry, openMemo } = useAppData();
  const today = new Date();

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-xl sm:px-6 lg:h-auto lg:py-3">
      <div className="flex items-baseline gap-2">
        <span className="label">Today</span>
        <span className="font-mono text-sm text-ink/70">{format(today, "EEE, MMM d, yyyy")}</span>
      </div>

      {/* Phones / tablets: scan a memo (photo -> one expense per item). The rest of the
          actions live in the bottom bar / More sheet. */}
      <button
        onClick={openMemo}
        aria-label="Scan a memo"
        className="entry-btn ml-auto inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-paper shadow-entry transition-transform duration-200 active:scale-[0.96] lg:hidden"
      >
        <Plus className="h-5 w-5" aria-hidden strokeWidth={2.5} />
      </button>

      {/* Desktop actions. */}
      <div className="ml-auto hidden items-center gap-3 lg:flex">
        <VaultModeToggle />
        <button
          onClick={openMemo}
          className="hairline inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <Camera className="h-4 w-4" aria-hidden />
          Scan memo
        </button>
        <button
          onClick={() => openEntry()}
          className="entry-btn inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper shadow-entry transition-transform duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />
          Entry
        </button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
