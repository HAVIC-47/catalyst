"use client";

// A dhar movement shown among a day's entries: + into a wallet, − out of it.
import Link from "next/link";
import { HandCoins } from "lucide-react";
import type { DharMove } from "@/lib/money";
import { cn, formatCurrency } from "@/lib/utils";
import { tr } from "@/lib/i18n";

export function dharLabel(m: DharMove): string {
  switch (m.kind) {
    case "borrowed":
      return tr("Borrowed from {person}", { person: m.person });
    case "lent":
      return tr("Lent to {person}", { person: m.person });
    case "repaid":
      return tr("Paid back {person}", { person: m.person });
    case "paidBack":
      return tr("{person} paid back", { person: m.person });
  }
}

export function DharLine({ move, wallet }: { move: DharMove; wallet?: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-amber">
        <HandCoins className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink/85">{dharLabel(move)}</div>
        <div className="text-[11px] text-ink/40">
          <Link href="/app/dhar" className="hover:text-amber">
            {tr("Dhar")}
          </Link>
          {wallet && <span> · {wallet}</span>}
        </div>
      </div>
      <span className={cn("font-mono text-sm tabular", move.amount > 0 ? "text-income" : "text-ink/80")}>
        {formatCurrency(move.amount, { sign: true })}
      </span>
    </li>
  );
}
