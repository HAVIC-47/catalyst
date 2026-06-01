"use client";

import { useState } from "react";
import { Vault, Info } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { cn } from "@/lib/utils";

// Toggle for Vault Mode: when on, every income adds to the savings pool and every
// expense draws from it. Hover (or focus) the info dot for an explainer.
export function VaultModeToggle() {
  const { vaultMode, setVaultMode } = useAppData();
  const [tip, setTip] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* Info with hover tooltip */}
      <div className="relative flex items-center">
        <button
          type="button"
          aria-label="What is Vault Mode?"
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          onFocus={() => setTip(true)}
          onBlur={() => setTip(false)}
          className="cursor-help text-ink/40 transition-colors hover:text-ink/70"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
        {tip && (
          <div
            role="tooltip"
            className="card absolute right-0 top-6 z-20 w-60 p-3 text-left text-xs leading-relaxed text-ink/70 shadow-card"
          >
            <span className="font-semibold text-ink">Vault Mode</span> — treat every
            transaction as part of your savings vault. Income is{" "}
            <span className="text-income">added</span> to savings and expenses are{" "}
            <span className="text-expense">drawn</span> from it, so this chart tracks your true
            net flow into savings.
          </div>
        )}
      </div>

      {/* Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={vaultMode}
        aria-label="Vault Mode"
        onClick={() => setVaultMode(!vaultMode)}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
          vaultMode
            ? "border-amber/50 bg-amber/[0.1] text-amber"
            : "border-line text-ink/50 hover:text-ink/75",
        )}
      >
        <Vault className="h-3.5 w-3.5" aria-hidden />
        Vault
        <span
          className={cn(
            "relative h-3.5 w-6 rounded-full transition-colors",
            vaultMode ? "bg-amber/70" : "bg-ink/20",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-paper transition-all",
              vaultMode ? "left-3" : "left-0.5",
            )}
          />
        </span>
      </button>
    </div>
  );
}
