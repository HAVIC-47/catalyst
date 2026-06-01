"use client";

// Horizontal bar chart: how many times each category appeared in a period.
// Renders both expense + income categories; each bar colored by its category's color.
import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Category, Transaction } from "@/types";
import { rangeWindow, type Range } from "@/lib/range";

const FALLBACK = "#7A746A";

export function CategoryBars({
  transactions,
  categories,
  range,
  offset,
}: {
  transactions: Transaction[];
  categories: Category[];
  range: Range;
  offset: number;
}) {
  const { startKey, endKey } = useMemo(() => rangeWindow(range, offset), [range, offset]);

  const bars = useMemo(() => {
    const colorOf = new Map(categories.map((c) => [c.name, c.color]));
    const kindOf = new Map(categories.map((c) => [c.name, c.kind]));
    const counts = new Map<string, number>();
    for (const t of transactions) {
      if (t.kind === "saving") continue; // savings don't have a category
      if (t.occurredOn < startKey || t.occurredOn > endKey) continue;
      counts.set(t.categoryName, (counts.get(t.categoryName) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => {
        const inferred = transactions.find((x) => x.categoryName === name)?.kind;
        const kind: "expense" | "income" =
          (kindOf.get(name) as "expense" | "income" | undefined) ??
          (inferred === "income" ? "income" : "expense");
        return {
          name,
          count,
          color: colorOf.get(name) ?? FALLBACK,
          kind,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [transactions, categories, startKey, endKey]);

  return (
    <div>
      {bars.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/35">No transactions this period.</p>
      ) : (
        <div style={{ height: Math.max(180, bars.length * 36 + 24) }} className="mt-1 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tick={{ fill: "rgb(var(--c-ink) / 0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fill: "rgb(var(--c-ink) / 0.7)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgb(var(--c-ink) / 0.06)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="card px-3 py-2 text-xs">
                      <div className="text-ink/80">{p.name}</div>
                      <div className="font-mono text-ink/55">
                        {p.count} {p.count === 1 ? "entry" : "entries"} · {p.kind}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[3, 3, 3, 3]} barSize={18}>
                {bars.map((b) => (
                  <Cell key={b.name} fill={b.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

