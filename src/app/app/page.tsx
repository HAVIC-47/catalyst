"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { moodPreset } from "@/types";
import { TAKA, cn, compactCurrency, formatCurrency, toDateKey } from "@/lib/utils";

type Range = "week" | "month" | "year";
const RANGES: Range[] = ["week", "month", "year"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface CellData {
  net: number;
  income: number;
  expense: number;
  mood?: number;
}

function hexToRgb(hex: string): string {
  const m = hex.replace("#", "");
  return `${parseInt(m.slice(0, 2), 16)}, ${parseInt(m.slice(2, 4), 16)}, ${parseInt(m.slice(4, 6), 16)}`;
}

/**
 * Layered tint for a day:
 *  - Base = mood color (red → green scale).
 *  - Purple overlay weighted by expense (higher spend = stronger purple).
 *  - Blue overlay weighted by income (higher income = stronger blue).
 * Layers stack via CSS `background` so both flow tints sit ON TOP of the mood base.
 */
function dayCellStyle(data: CellData | undefined, maxFlow: number): CSSProperties {
  if (!data) return {};
  const flow = data.expense + data.income;
  if (flow === 0 && !data.mood) return {};

  const moodRgb = data.mood ? hexToRgb(moodPreset(data.mood).color) : "122, 116, 106";
  const moodA = data.mood ? 0.2 : 0.05;

  const spendRatio = maxFlow > 0 ? data.expense / maxFlow : 0;
  const incomeRatio = maxFlow > 0 ? data.income / maxFlow : 0;
  const spendA = Math.min(0.42, spendRatio * 0.48);
  const incomeA = Math.min(0.42, incomeRatio * 0.48);

  const layers: string[] = [];
  // oxblood overlay for spend, ink-blue overlay for income — printed-ink tints.
  if (spendA > 0) layers.push(`linear-gradient(rgba(155,58,45,${spendA}),rgba(155,58,45,${spendA}))`);
  if (incomeA > 0) layers.push(`linear-gradient(rgba(52,97,138,${incomeA}),rgba(52,97,138,${incomeA}))`);
  layers.push(`rgba(${moodRgb}, ${moodA})`);
  return { background: layers.join(", ") };
}

export default function CalendarPage() {
  const { transactions, moods, openEntry, loading } = useAppData();
  const [range, setRange] = useState<Range>("month");
  const [cursor, setCursor] = useState(() => new Date());

  // Index every day across all data once.
  const byDay = useMemo(() => {
    type Cell = CellData & { moodSum: number; moodN: number };
    const map = new Map<string, Cell>();
    const get = (k: string): Cell =>
      map.get(k) ?? map.set(k, { net: 0, income: 0, expense: 0, moodSum: 0, moodN: 0 }).get(k)!;
    for (const t of transactions) {
      const e = get(t.occurredOn);
      if (t.kind === "income") {
        e.income += t.amount;
        e.net += t.amount;
      } else {
        e.expense += t.amount;
        e.net -= t.amount;
      }
    }
    for (const m of moods) {
      const e = get(m.loggedOn);
      e.moodSum += m.mood;
      e.moodN += 1;
    }
    for (const e of map.values()) if (e.moodN > 0) e.mood = Math.round(e.moodSum / e.moodN);
    return map;
  }, [transactions, moods]);

  const period = useMemo(() => {
    if (range === "week") {
      const s = startOfWeek(cursor);
      const e = endOfWeek(cursor);
      return { start: s, end: e, label: `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}` };
    }
    if (range === "year") {
      const s = startOfYear(cursor);
      const e = endOfYear(cursor);
      return { start: s, end: e, label: format(cursor, "yyyy") };
    }
    return {
      start: startOfMonth(cursor),
      end: endOfMonth(cursor),
      label: format(cursor, "MMMM yyyy"),
    };
  }, [range, cursor]);

  const summary = useMemo(() => {
    let income = 0,
      expense = 0,
      count = 0,
      maxFlow = 0;
    const startKey = toDateKey(period.start);
    const endKey = toDateKey(period.end);
    for (const [key, v] of byDay) {
      if (key < startKey || key > endKey) continue;
      income += v.income;
      expense += v.expense;
      if (v.income || v.expense || v.mood) count++;
      maxFlow = Math.max(maxFlow, v.income + v.expense);
    }
    return { income, expense, net: income - expense, count, maxFlow };
  }, [byDay, period]);

  const goPrev = () =>
    setCursor((c) => (range === "week" ? addWeeks(c, -1) : range === "year" ? addYears(c, -1) : addMonths(c, -1)));
  const goNext = () =>
    setCursor((c) => (range === "week" ? addWeeks(c, 1) : range === "year" ? addYears(c, 1) : addMonths(c, 1)));

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Calendar · {summary.count} active days</div>
          <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            {period.label}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-sm">
            <span className="text-ink/45">
              NET{" "}
              <span className={summary.net >= 0 ? "text-income" : "text-expense"}>
                {formatCurrency(summary.net, { sign: true })}
              </span>
            </span>
            <span className="text-ink/30">·</span>
            <span className="text-ink/45">
              IN <span className="text-income">{compactCurrency(summary.income)}</span>
            </span>
            <span className="text-ink/45">
              OUT <span className="text-expense">{compactCurrency(summary.expense)}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-line bg-ink/[0.02] p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                  setCursor(new Date());
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

          <button
            onClick={goPrev}
            aria-label="Previous"
            className="hairline flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="hairline h-10 cursor-pointer rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Today
          </button>
          <button
            onClick={goNext}
            aria-label="Next"
            className="hairline flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-widest text-ink/40">
        <div className="flex items-center gap-2">
          <span className="text-ink/55">Mood</span>
          <div className="h-2.5 w-28 rounded-full bg-gradient-to-r from-[#A8322A] via-[#B59A3C] to-[#2E8159]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#7A4E86" }} />
          Heavier spend
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#3D80BC" }} />
          Heavier income
        </div>
      </div>

      {range === "week" && <WeekView cursor={cursor} byDay={byDay} maxFlow={summary.maxFlow} openEntry={openEntry} />}
      {range === "month" && (
        <MonthGrid cursor={cursor} byDay={byDay} maxFlow={summary.maxFlow} openEntry={openEntry} />
      )}
      {range === "year" && <YearView cursor={cursor} byDay={byDay} openEntry={openEntry} />}

      {loading && <p className="mt-4 text-center font-mono text-xs text-ink/30">Loading…</p>}
    </div>
  );
}

/* ----------------------------------------------------------- Month grid */
function MonthGrid({
  cursor,
  byDay,
  maxFlow,
  openEntry,
}: {
  cursor: Date;
  byDay: Map<string, CellData & { moodSum: number; moodN: number }>;
  maxFlow: number;
  openEntry: (o: { date: string; tab: "money" }) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-3 py-2.5 font-mono text-[10px] tracking-[0.2em] text-ink/35">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = toDateKey(day);
          const inMonth = isSameMonth(day, cursor);
          const data = byDay.get(key);
          const today = isToday(day);
          const preset = data?.mood ? moodPreset(data.mood) : null;
          return (
            <motion.button
              key={key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.004, 0.2) }}
              onClick={() => openEntry({ date: key, tab: "money" })}
              style={dayCellStyle(data, maxFlow)}
              className={cn(
                "group relative flex min-h-[92px] cursor-pointer flex-col border-b border-r border-line p-2 text-left transition-colors duration-150 hover:!bg-ink/[0.06] sm:min-h-[110px]",
                !inMonth && "opacity-35",
                (i + 1) % 7 === 0 && "border-r-0",
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "font-mono text-xs tabular",
                    today
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-amber font-semibold text-paper"
                      : "text-ink/70",
                  )}
                >
                  {format(day, "dd")}
                </span>
                {preset && <span className="text-base leading-none">{preset.emoji}</span>}
              </div>
              {data && (data.income > 0 || data.expense > 0) && (
                <div className="mt-auto space-y-0.5 font-mono text-[11px] tabular">
                  {data.expense > 0 && (
                    <div className="text-expense">−{compactCurrency(data.expense).replace(TAKA, TAKA)}</div>
                  )}
                  {data.income > 0 && <div className="text-income">+{compactCurrency(data.income)}</div>}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Week strip */
function WeekView({
  cursor,
  byDay,
  maxFlow,
  openEntry,
}: {
  cursor: Date;
  byDay: Map<string, CellData & { moodSum: number; moodN: number }>;
  maxFlow: number;
  openEntry: (o: { date: string; tab: "money" }) => void;
}) {
  const start = startOfWeek(cursor);
  const days = eachDayOfInterval({ start, end: endOfWeek(cursor) });
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-3 py-2.5 font-mono text-[10px] tracking-[0.2em] text-ink/35">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = toDateKey(day);
          const data = byDay.get(key);
          const today = isToday(day);
          const preset = data?.mood ? moodPreset(data.mood) : null;
          return (
            <button
              key={key}
              onClick={() => openEntry({ date: key, tab: "money" })}
              style={dayCellStyle(data, maxFlow)}
              className={cn(
                "group flex min-h-[200px] cursor-pointer flex-col border-r border-line p-3 text-left transition-colors duration-150 hover:!bg-ink/[0.06]",
                i === 6 && "border-r-0",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-sm tabular",
                    today
                      ? "flex h-7 w-7 items-center justify-center rounded-full bg-amber font-semibold text-paper"
                      : "text-ink/75",
                  )}
                >
                  {format(day, "dd")}
                </span>
                {preset && <span className="text-2xl">{preset.emoji}</span>}
              </div>
              <div className="mt-auto space-y-1 font-mono text-xs tabular">
                {data?.expense ? (
                  <div className="text-expense">−{compactCurrency(data.expense)}</div>
                ) : null}
                {data?.income ? (
                  <div className="text-income">+{compactCurrency(data.income)}</div>
                ) : null}
                {preset && <div className="text-ink/45">{preset.label}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Year (12 mini months) */
function YearView({
  cursor,
  byDay,
  openEntry,
}: {
  cursor: Date;
  byDay: Map<string, CellData & { moodSum: number; moodN: number }>;
  openEntry: (o: { date: string; tab: "money" }) => void;
}) {
  const year = cursor.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map((mDate) => {
        const ms = startOfMonth(mDate);
        const me = endOfMonth(mDate);
        const gs = new Date(ms);
        gs.setDate(ms.getDate() - ms.getDay());
        const ge = new Date(me);
        ge.setDate(me.getDate() + (6 - me.getDay()));
        const days = eachDayOfInterval({ start: gs, end: ge });

        // local maxFlow per month so each tile reads independently
        let maxFlow = 0;
        for (const d of days) {
          const c = byDay.get(toDateKey(d));
          if (c) maxFlow = Math.max(maxFlow, c.income + c.expense);
        }

        return (
          <div key={mDate.getMonth()} className="card p-3">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="font-display text-lg font-semibold text-ink">{format(mDate, "MMM")}</h3>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink/30">
                {format(mDate, "yyyy")}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center font-mono text-[8px] tracking-widest text-ink/25">
                  {d[0]}
                </div>
              ))}
              {days.map((day) => {
                const key = toDateKey(day);
                const data = byDay.get(key);
                const inMonth = isSameMonth(day, mDate);
                const today = isToday(day);
                return (
                  <button
                    key={key}
                    onClick={() => openEntry({ date: key, tab: "money" })}
                    style={dayCellStyle(data, maxFlow)}
                    title={
                      data
                        ? `${format(day, "MMM d")} · spent ${compactCurrency(data.expense)} · earned ${compactCurrency(data.income)}${data.mood ? ` · mood ${data.mood}/5` : ""}`
                        : format(day, "MMM d")
                    }
                    className={cn(
                      "flex aspect-square cursor-pointer items-center justify-center rounded-[3px] font-mono text-[9px] tabular transition-colors hover:!bg-ink/15",
                      !inMonth && "opacity-25",
                      today && "ring-1 ring-amber",
                      !data && "bg-ink/[0.03]",
                    )}
                  >
                    <span className="text-ink/55">{format(day, "d")}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
