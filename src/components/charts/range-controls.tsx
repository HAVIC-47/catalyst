"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { RANGES, type Range } from "@/lib/range";
import { cn } from "@/lib/utils";

// The dashboard's single period selector: Day / Week / Month / Year + prev / Now / next.
// Compact on phones so both groups share one row. `ranges` narrows the choice
// (the AI summaries offer Week / Month / Year).
export function RangeControls({
  range,
  setRange,
  offset,
  setOffset,
  ranges = RANGES,
}: {
  range: Range;
  setRange: (r: Range) => void;
  offset: number;
  setOffset: (o: number | ((p: number) => number)) => void;
  ranges?: readonly Range[];
}) {
  const navCls =
    "hairline flex h-8 cursor-pointer items-center justify-center rounded-lg text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40 sm:h-9";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-0.5 rounded-xl border border-line bg-ink/[0.02] p-0.5 sm:gap-1 sm:p-1">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => {
              setRange(r);
              setOffset(0);
            }}
            className={cn(
              "cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium capitalize transition-colors duration-200 sm:px-3 sm:py-1.5 sm:text-xs",
              range === r ? "seg-on text-amber" : "text-ink/45 hover:text-ink/75",
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
          className={cn(navCls, "w-8 sm:w-9")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          onClick={() => setOffset(0)}
          disabled={offset === 0}
          className={cn(navCls, "px-2 font-mono text-[10px] uppercase tracking-widest sm:px-3 sm:text-[11px]")}
        >
          Now
        </button>
        <button
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          aria-label="Next period"
          className={cn(navCls, "w-8 sm:w-9")}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
