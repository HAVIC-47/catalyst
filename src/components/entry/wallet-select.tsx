"use client";

// Picks the wallet an entry came from or went into. Shows nothing until the
// database has wallets (so older setups look exactly as before).
import { useAppData } from "@/hooks/use-app-data";
import { defaultWallet } from "@/lib/money";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

const LAST = "wallet:last";

/** The wallet a new entry starts with: the one used last on this browser, else the default. */
export function useStartWallet(): string | null {
  const { wallets } = useAppData();
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST);
  } catch {
    /* ignore */
  }
  const live = wallets.filter((w) => !w.archived);
  return live.find((w) => w.id === last)?.id ?? defaultWallet(wallets)?.id ?? null;
}

/** Remember the wallet just used, for the next entry. */
export function rememberWallet(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST, id);
  } catch {
    /* ignore */
  }
}

export function WalletSelect({
  value,
  onChange,
  label = "Wallet",
  className,
  compact = false,
}: {
  value: string | null;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const { wallets, walletsReady } = useAppData();
  if (!walletsReady || wallets.length === 0) return null;
  // Archived wallets stay listed only when they're the current choice.
  const options = wallets.filter((w) => !w.archived || w.id === value);
  const current = value ?? defaultWallet(wallets)?.id ?? "";
  return (
    <div className={className}>
      {!compact && <div className="label mb-2">{label}</div>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((w) => {
          const on = current === w.id;
          return (
            <button
              key={w.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(w.id)}
              className={cn(
                "inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors duration-200",
                on ? "border-ink/30 bg-ink/[0.06] text-ink" : "border-line text-ink/55 hover:bg-ink/[0.03] hover:text-ink/80",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: w.color }} aria-hidden />
              {tr(w.name)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
