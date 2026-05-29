"use client";

// Savings donut — Added (saving entries) vs Broken (Break-saving expenses), with the
// net value in the center. Mirrors the CategoryDonut format.
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { BREAK_SAVING, type Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { rangeWindow, type Range } from "@/lib/range";
import { RangeControls } from "@/components/charts/range-controls";

const ADDED_COLOR = "#34618A"; // blue
const BROKEN_COLOR = "#B23A2C"; // rose

export function SavingsDonut({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<Range>("month");
  const [offset, setOffset] = useState(0);
  const { startKey, endKey, label } = useMemo(() => rangeWindow(range, offset), [range, offset]);

  const { added, broken, net } = useMemo(() => {
    let a = 0;
    let b = 0;
    for (const t of transactions) {
      if (t.occurredOn < startKey || t.occurredOn > endKey) continue;
      if (t.kind === "saving") a += t.amount;
      else if (t.kind === "expense" && t.categoryName === BREAK_SAVING) b += t.amount;
    }
    return { added: a, broken: b, net: a - b };
  }, [transactions, startKey, endKey]);

  const slices = [
    { name: "Added", value: added, color: ADDED_COLOR },
    { name: "Broken", value: broken, color: BROKEN_COLOR },
  ].filter((s) => s.value > 0);

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
        <p className="py-12 text-center text-sm text-ink/35">No saving activity this period.</p>
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
              <span className="label">Net</span>
              <span
                className="font-mono text-lg font-semibold tabular"
                style={{ color: net >= 0 ? ADDED_COLOR : BROKEN_COLOR }}
              >
                {formatCurrency(net, { sign: true })}
              </span>
            </div>
          </div>

          <ul className="w-full space-y-1.5">
            <li className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ADDED_COLOR }} />
              <span className="text-ink/65">Added</span>
              <span className="ml-auto font-mono tabular text-ink/50">{formatCurrency(added)}</span>
            </li>
            <li className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BROKEN_COLOR }} />
              <span className="text-ink/65">Broken</span>
              <span className="ml-auto font-mono tabular text-ink/50">{formatCurrency(broken)}</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
