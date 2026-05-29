"use client";

// Mood ↔ money overlap chart with Day / Week / Month / Year ranges and
// prev/next navigation. Net cash flow (bars) vs mood index (line), dual Y-axes.
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MoodLog, Transaction } from "@/types";
import { pearson, correlationLabel } from "@/lib/math";
import { cn, compactCurrency, formatCurrency, toDateKey } from "@/lib/utils";

type Range = "day" | "week" | "month" | "year";
const RANGES: Range[] = ["day", "week", "month", "year"];

interface Point {
  key: string; // bucket key
  label: string; // x-axis label
  net: number; // signed (income - expense - break-saving expense)
  saving: number; // positive saving contribution
  mood: number | null;
}

export function OverlapChart({
  transactions,
  moods,
}: {
  transactions: Transaction[];
  moods: MoodLog[];
}) {
  const [range, setRange] = useState<Range>("month");
  const [offset, setOffset] = useState(0); // 0 = current period, -1 = previous, etc.

  const { points, periodLabel } = useMemo(
    () => buildPoints(transactions, moods, range, offset),
    [transactions, moods, range, offset],
  );

  const correlation = useMemo(() => {
    const paired = points.filter((p) => p.mood !== null);
    return pearson(
      paired.map((p) => p.mood as number),
      paired.map((p) => p.net),
    );
  }, [points]);

  const byMonth = range === "year";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label">Trend · {periodLabel}</div>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
            Mood <span className="serif-italic text-ink/50">×</span> money
          </h2>
        </div>
        <div className="text-right font-mono text-xs">
          <div className="text-ink/40">r = {correlation.toFixed(2)}</div>
          <div className="text-ink/30">{correlationLabel(correlation)}</div>
        </div>
      </div>

      {/* controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-line bg-ink/[0.02] p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r);
                setOffset(0);
              }}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors duration-200",
                range === r ? "bg-ink/[0.08] text-amber" : "text-ink/45 hover:text-ink/75",
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
            className="hairline flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            onClick={() => setOffset(0)}
            disabled={offset === 0}
            className="hairline h-9 cursor-pointer rounded-lg px-3 font-mono text-[11px] uppercase tracking-widest text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
          >
            Now
          </button>
          <button
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset >= 0}
            aria-label="Next period"
            className="hairline flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={byMonth ? 8 : 20}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="money"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => compactCurrency(v)}
              width={52}
            />
            <YAxis
              yAxisId="mood"
              orientation="right"
              domain={[0, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fill: "rgba(122,78,134,0.75)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={22}
            />
            <ReferenceLine yAxisId="money" y={0} stroke="rgba(255,255,255,0.12)" />
            <Tooltip content={<OverlapTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar yAxisId="money" dataKey="net" name="Net" radius={[3, 3, 0, 0]} maxBarSize={byMonth ? 24 : 14}>
              {points.map((p) => (
                <Cell key={p.key} fill={p.net >= 0 ? "#2E8159" : "#CB453B"} />
              ))}
            </Bar>
            <Bar
              yAxisId="money"
              dataKey="saving"
              name="Saving"
              fill="#3D80BC"
              radius={[3, 3, 0, 0]}
              maxBarSize={byMonth ? 24 : 14}
            />
            <Line
              yAxisId="mood"
              type="monotone"
              dataKey="mood"
              name="Mood"
              stroke="#7A4E86"
              strokeWidth={2}
              dot={range === "day" || range === "week" ? { r: 3, fill: "#7A4E86" } : false}
              connectNulls
              activeDot={{ r: 4, fill: "#7A4E86" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const avg = (xs: number[]) =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

function buildPoints(
  transactions: Transaction[],
  moods: MoodLog[],
  range: Range,
  offset: number,
): { points: Point[]; periodLabel: string } {
  const now = new Date();

  const moneyDelta = (t: Transaction) =>
    t.kind === "income" ? t.amount : t.kind === "expense" ? -t.amount : 0;

  // ---- Day view: intraday hourly buckets (uses occurred_at / logged_at times) ----
  if (range === "day") {
    const day = addDays(now, offset);
    const dayKey = toDateKey(day);
    const netByHour = new Array(24).fill(0);
    const savingByHour = new Array(24).fill(0);
    const moodsByHour: number[][] = Array.from({ length: 24 }, () => []);
    for (const t of transactions) {
      if (t.occurredOn !== dayKey) continue;
      const h = new Date(t.occurredAt).getHours();
      if (t.kind === "saving") savingByHour[h] += t.amount;
      else netByHour[h] += moneyDelta(t);
    }
    for (const m of moods) {
      if (m.loggedOn !== dayKey) continue;
      moodsByHour[new Date(m.loggedAt).getHours()].push(m.mood);
    }
    const points = Array.from({ length: 24 }, (_, h) => {
      const d = new Date(day);
      d.setHours(h, 0, 0, 0);
      return {
        key: `h${h}`,
        label: format(d, "ha"),
        net: Math.round(netByHour[h] * 100) / 100,
        saving: Math.round(savingByHour[h] * 100) / 100,
        mood: avg(moodsByHour[h]),
      };
    });
    return { points, periodLabel: format(day, "EEE, MMM d, yyyy") };
  }

  // Aggregate per day-key (moods averaged, savings separate from net).
  const netByDay = new Map<string, number>();
  const savingByDay = new Map<string, number>();
  for (const t of transactions) {
    if (t.kind === "saving") {
      savingByDay.set(t.occurredOn, (savingByDay.get(t.occurredOn) ?? 0) + t.amount);
    } else {
      netByDay.set(t.occurredOn, (netByDay.get(t.occurredOn) ?? 0) + moneyDelta(t));
    }
  }
  const moodsByDay = new Map<string, number[]>();
  for (const m of moods) (moodsByDay.get(m.loggedOn) ?? moodsByDay.set(m.loggedOn, []).get(m.loggedOn)!).push(m.mood);

  if (range === "year") {
    const anchor = addYears(now, offset);
    const months = eachMonthOfInterval({ start: startOfYear(anchor), end: endOfYear(anchor) });
    const points = months.map((mDate) => {
      const ym = format(mDate, "yyyy-MM");
      let net = 0;
      let savings = 0;
      const moodVals: number[] = [];
      for (const [k, v] of netByDay) if (k.startsWith(ym)) net += v;
      for (const [k, v] of savingByDay) if (k.startsWith(ym)) savings += v;
      for (const [k, arr] of moodsByDay) if (k.startsWith(ym)) moodVals.push(...arr);
      return {
        key: ym,
        label: format(mDate, "MMM"),
        net: Math.round(net * 100) / 100,
        saving: Math.round(savings * 100) / 100,
        mood: avg(moodVals),
      };
    });
    return { points, periodLabel: format(anchor, "yyyy") };
  }

  // week / month -> daily buckets
  let start: Date;
  let end: Date;
  let periodLabel: string;
  if (range === "week") {
    const anchor = addWeeks(now, offset);
    start = startOfWeek(anchor);
    end = endOfWeek(anchor);
    periodLabel = `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  } else {
    const anchor = addMonths(now, offset);
    start = startOfMonth(anchor);
    end = endOfMonth(anchor);
    periodLabel = format(anchor, "MMMM yyyy");
  }

  const points = eachDayOfInterval({ start, end }).map((d) => {
    const k = toDateKey(d);
    return {
      key: k,
      label: format(d, range === "week" ? "EEE" : "MMM d"),
      net: Math.round((netByDay.get(k) ?? 0) * 100) / 100,
      saving: Math.round((savingByDay.get(k) ?? 0) * 100) / 100,
      mood: avg(moodsByDay.get(k) ?? []),
    };
  });
  return { points, periodLabel };
}

function OverlapTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="card px-3 py-2 text-xs">
      <div className="mb-1 font-mono text-ink/50">{p.label}</div>
      <div className={p.net >= 0 ? "text-income" : "text-expense"}>
        Net {formatCurrency(p.net, { sign: true })}
      </div>
      {p.saving > 0 && (
        <div style={{ color: "#3D80BC" }}>Saving +{formatCurrency(p.saving)}</div>
      )}
      <div className="text-neon-purple">
        Mood {p.mood ?? "—"}
        {p.mood ? " / 5" : ""}
      </div>
    </div>
  );
}
