"use client";

// Mood ↔ money overlap chart with Day / Week / Month / Year ranges and
// prev/next navigation. Net cash flow (bars) vs mood index (line), dual Y-axes.
import { useMemo } from "react";
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
import type { MoodLog, Transaction } from "@/types";
import { pearson, correlationLabel } from "@/lib/math";
import { compactCurrency, formatCurrency, toDateKey, fmt } from "@/lib/utils";
import type { Range } from "@/lib/range";
import { RangeControls } from "@/components/charts/range-controls";
import { tr, digits } from "@/lib/i18n";

interface Point {
  key: string; // bucket key
  label: string; // x-axis label
  net: number; // signed (income - expense - break-saving expense)
  saving: number; // positive saving contribution
  mood: number | null;
}

// Single source of truth for the period — the dashboard owns range/offset and
// every chart (this one + all the donuts/bars) reads the same value.
export function OverlapChart({
  transactions,
  moods,
  range,
  offset,
  setRange,
  setOffset,
}: {
  transactions: Transaction[];
  moods: MoodLog[];
  range: Range;
  offset: number;
  setRange: (r: Range) => void;
  setOffset: (o: number | ((p: number) => number)) => void;
}) {
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
      {/* Fixed three-line header (nothing wraps), so the phone layout can budget its height. */}
      <div className="mb-3 sm:mb-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="label truncate">{tr("Trend · {periodLabel}", { periodLabel })}</div>
          <div className="shrink-0 font-mono text-[11px] text-ink/40 sm:text-xs">r = {digits(correlation.toFixed(2))}</div>
        </div>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">
          {tr("Mood")}{" "}<span className="serif-italic text-ink/50">×</span>{" "}{tr("money")}
        </h2>
        <div className="truncate font-mono text-[11px] text-ink/40 sm:text-xs">
          {correlationLabel(correlation)}
        </div>
      </div>

      <div className="mb-3 sm:mb-4">
        <RangeControls range={range} setRange={setRange} offset={offset} setOffset={setOffset} />
      </div>

      {/* .trend-plot: shrinks on phones so the card fits the first screen. */}
      <div className="trend-plot w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgb(var(--c-ink) / 0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgb(var(--c-ink) / 0.55)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={byMonth ? 8 : 20}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="money"
              tick={{ fill: "rgb(var(--c-ink) / 0.55)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => compactCurrency(v)}
              width={48}
            />
            <YAxis
              yAxisId="mood"
              orientation="right"
              domain={[0, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tickFormatter={(v) => digits(String(v))}
              tick={{ fill: "rgb(var(--c-violet-text))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={22}
            />
            <ReferenceLine yAxisId="money" y={0} stroke="rgb(var(--c-ink) / 0.18)" />
            <Tooltip content={<OverlapTooltip />} cursor={{ fill: "rgb(var(--c-ink) / 0.06)" }} />
            <Bar yAxisId="money" dataKey="net" name="Net" radius={[3, 3, 0, 0]} maxBarSize={byMonth ? 24 : 14}>
              {points.map((p) => (
                <Cell key={p.key} fill={p.net >= 0 ? "rgb(var(--c-income))" : "rgb(var(--c-expense))"} />
              ))}
            </Bar>
            <Bar
              yAxisId="money"
              dataKey="saving"
              name="Saving"
              fill="rgb(var(--c-saving))"
              radius={[3, 3, 0, 0]}
              maxBarSize={byMonth ? 24 : 14}
            />
            <Line
              yAxisId="mood"
              type="monotone"
              dataKey="mood"
              name="Mood"
              stroke="rgb(var(--c-violet))"
              strokeWidth={2}
              dot={range === "day" || range === "week" ? { r: 3, fill: "rgb(var(--c-violet))" } : false}
              connectNulls
              activeDot={{ r: 4, fill: "rgb(var(--c-violet))" }}
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
        label: fmt(d, "ha"),
        net: Math.round(netByHour[h] * 100) / 100,
        saving: Math.round(savingByHour[h] * 100) / 100,
        mood: avg(moodsByHour[h]),
      };
    });
    return { points, periodLabel: fmt(day, "EEE, MMM d, yyyy") };
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
        label: fmt(mDate, "MMM"),
        net: Math.round(net * 100) / 100,
        saving: Math.round(savings * 100) / 100,
        mood: avg(moodVals),
      };
    });
    return { points, periodLabel: fmt(anchor, "yyyy") };
  }

  // week / month -> daily buckets
  let start: Date;
  let end: Date;
  let periodLabel: string;
  if (range === "week") {
    const anchor = addWeeks(now, offset);
    start = startOfWeek(anchor);
    end = endOfWeek(anchor);
    periodLabel = `${fmt(start, "MMM d")} – ${fmt(end, "MMM d")}`;
  } else {
    const anchor = addMonths(now, offset);
    start = startOfMonth(anchor);
    end = endOfMonth(anchor);
    periodLabel = fmt(anchor, "MMMM yyyy");
  }

  const points = eachDayOfInterval({ start, end }).map((d) => {
    const k = toDateKey(d);
    return {
      key: k,
      label: fmt(d, range === "week" ? "EEE" : "MMM d"),
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
      <div className={p.net >= 0 ? "text-income" : "text-expense"}>{tr("Net {amount}", { amount: formatCurrency(p.net, { sign: true }) })}</div>
      {p.saving > 0 && (
        <div style={{ color: "rgb(var(--c-saving))" }}>{tr("Saving +{amount}", { amount: formatCurrency(p.saving) })}</div>
      )}
      <div className="text-neon-purple">
        {tr("Mood")}{" "}{p.mood ?? "—"}
        {p.mood ? " / 5" : ""}
      </div>
    </div>
  );
}
