"use client";

// Bar chart of mood-context tag frequency: how many times each
// "What was it about?" tag (Family time / Travel / Work…) was selected.
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MoodLog } from "@/types";
import { rangeWindow, type Range } from "@/lib/range";
import { RangeControls } from "@/components/charts/range-controls";

const TAG_COLORS = [
  "#22D3EE", "#A855F7", "#F59E0B", "#34D399", "#F43F5E",
  "#38BDF8", "#FB7185", "#C084FC", "#84CC16", "#EC4899",
  "#FBBF24", "#2DD4BF",
];

export function MoodTagBars({ moods }: { moods: MoodLog[] }) {
  const [range, setRange] = useState<Range>("month");
  const [offset, setOffset] = useState(0);
  const { startKey, endKey, label } = useMemo(() => rangeWindow(range, offset), [range, offset]);

  const bars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of moods) {
      if (m.loggedOn < startKey || m.loggedOn > endKey) continue;
      for (const tag of m.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count], i) => ({ name, count, color: TAG_COLORS[i % TAG_COLORS.length] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [moods, startKey, endKey]);

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

      {bars.length === 0 ? (
        <p className="py-12 text-center text-sm text-white/35">
          No mood tags logged this period.
        </p>
      ) : (
        <div style={{ height: Math.max(180, bars.length * 36 + 24) }} className="mt-4 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="card px-3 py-2 text-xs">
                      <div className="text-white/80">{p.name}</div>
                      <div className="font-mono text-white/55">
                        {p.count} {p.count === 1 ? "time" : "times"}
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
