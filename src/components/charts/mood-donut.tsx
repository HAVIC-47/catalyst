"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { MOOD_PRESETS, type MoodLog } from "@/types";
import { rangeWindow, type Range } from "@/lib/range";

export function MoodDonut({ moods, range, offset }: { moods: MoodLog[]; range: Range; offset: number }) {
  const { startKey, endKey } = useMemo(() => rangeWindow(range, offset), [range, offset]);

  const slices = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of moods) {
      if (m.loggedOn < startKey || m.loggedOn > endKey) continue;
      counts.set(m.mood, (counts.get(m.mood) ?? 0) + 1);
    }
    return MOOD_PRESETS.filter((p) => (counts.get(p.value) ?? 0) > 0).map((p) => ({
      name: p.label,
      emoji: p.emoji,
      value: counts.get(p.value) ?? 0,
      color: p.color,
    }));
  }, [moods, startKey, endKey]);

  const total = slices.reduce((s, x) => s + x.value, 0);

  return (
    <div>

      {slices.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/35">No moods logged this period.</p>
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
              <span className="label">Logs</span>
              <span className="font-mono text-lg font-semibold tabular text-ink">{total}</span>
            </div>
          </div>

          <ul className="w-full space-y-1.5">
            {slices.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-ink/65">
                  <span className="mr-1">{s.emoji}</span>
                  {s.name}
                </span>
                <span className="ml-auto font-mono tabular text-ink/50">
                  {s.value} {s.value === 1 ? "log" : "logs"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
