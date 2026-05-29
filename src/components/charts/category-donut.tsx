"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Category, Kind, Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { rangeWindow, type Range } from "@/lib/range";
import { RangeControls } from "@/components/charts/range-controls";

const FALLBACK = "#7A746A";

export function CategoryDonut({
  transactions,
  categories,
  kind,
}: {
  transactions: Transaction[];
  categories: Category[];
  kind: Kind;
}) {
  const [range, setRange] = useState<Range>("month");
  const [offset, setOffset] = useState(0);

  const { startKey, endKey, label } = useMemo(() => rangeWindow(range, offset), [range, offset]);

  const slices = useMemo(() => {
    const colorOf = new Map(categories.map((c) => [c.name, c.color]));
    const totals = new Map<string, number>();
    for (const t of transactions) {
      if (t.kind !== kind) continue;
      if (t.occurredOn < startKey || t.occurredOn > endKey) continue;
      totals.set(t.categoryName, (totals.get(t.categoryName) ?? 0) + t.amount);
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value, color: colorOf.get(name) ?? FALLBACK }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, kind, startKey, endKey]);

  const total = slices.reduce((s, x) => s + x.value, 0);
  const headerLabel = kind === "expense" ? "Spent" : "Earned";
  const emptyLabel = kind === "expense" ? "No spending this period." : "No income this period.";

  return (
    <div>
      <RangeControls
        range={range}
        setRange={setRange}
        offset={offset}
        setOffset={setOffset}
        label={label}
        compact
      />

      {slices.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/35">{emptyLabel}</p>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-5">
          <div className="relative h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="label">{headerLabel}</span>
              <span className="font-mono text-lg font-semibold tabular text-ink">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          <ul className="w-full space-y-1.5">
            {slices.slice(0, 6).map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-ink/65">{s.name}</span>
                <span className="ml-auto font-mono tabular text-ink/50">
                  {formatCurrency(s.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
