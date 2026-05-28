"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { RANGES, type Range } from "@/lib/range";
import { cn } from "@/lib/utils";

export function RangeControls({
  range,
  setRange,
  offset,
  setOffset,
  label,
  compact = false,
}: {
  range: Range;
  setRange: (r: Range) => void;
  offset: number;
  setOffset: (o: number | ((p: number) => number)) => void;
  label: string;
  compact?: boolean;
}) {
  const sizeCls = compact ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-line bg-white/[0.02] p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r);
                setOffset(0);
              }}
              className={cn(
                "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-colors duration-200",
                range === r ? "bg-white/[0.08] text-amber" : "text-white/45 hover:text-white/75",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Previous period"
            className={cn(
              "hairline flex cursor-pointer items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/5 hover:text-white",
              sizeCls,
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0}
            aria-label="Next period"
            className={cn(
              "hairline flex cursor-pointer items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40",
              sizeCls,
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="font-mono text-[11px] uppercase tracking-widest text-white/35">{label}</div>
    </div>
  );
}
