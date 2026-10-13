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
import { MoodIcon } from "@/components/ui/mood-icon";

type Range = "week" | "month" | "year";
const RANGES: Range[] = ["week", "month", "year"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface CellData {
  net: number;
  income: number;
  expense: number;
  mood?: number;
}

/** "#RRGGBB" -> "r g b" (space-separated, for rgb(r g b / a)). */
function hexToRgb(hex: string): string {
  const m = hex.replace("#", "");
  return `${parseInt(m.slice(0, 2), 16)} ${parseInt(m.slice(2, 4), 16)} ${parseInt(m.slice(4, 6), 16)}`;
}

/**
 * Layered tint for a day:
 *  - Base = mood color (red → green scale).
 *  - Red overlay weighted by expense (higher spend = stronger).
 *  - Blue overlay weighted by income (higher income = stronger).
 * Layers stack via CSS `background` so both flow tints sit ON TOP of the mood base.
 * Colors and strength come from theme variables (--tint-*): deep printed-ink
 * overlays on black, lighter pastel washes on white.
 */
function dayCellStyle(data: CellData | undefined, maxFlow: number): CSSProperties {
  if (!data) return {};
  const flow = data.expense + data.income;
  if (flow === 0 && !data.mood) return {};

  const moodRgb = data.mood ? hexToRgb(moodPreset(data.mood).color) : "122 116 106";
  const moodA = data.mood ? 0.2 : 0.05;

  const spendRatio = maxFlow > 0 ? data.expense / maxFlow : 0;
  const incomeRatio = maxFlow > 0 ? data.income / maxFlow : 0;
  const spendA = Math.min(0.42, spendRatio * 0.48);
  const incomeA = Math.min(0.42, incomeRatio * 0.48);

  const wash = (rgb: string, a: number) => {
    const c = `rgb(${rgb} / calc(${a.toFixed(3)} * var(--tint-k)))`;
    return `linear-gradient(${c},${c})`;
  };
  const layers: string[] = [];
  if (spendA > 0) layers.push(wash("var(--tint-spend)", spendA));
  if (incomeA > 0) layers.push(wash("var(--tint-income)", incomeA));
  layers.push(`rgb(${moodRgb} / calc(${moodA} * var(--tint-mood-k)))`);
  return { background: layers.join(", ") };
}

/**
 * Year-view tint. Same idea as dayCellStyle (mood base + flow overlay) but built
 * for tiny cells where the color is the only signal: brighter data colors, much
 * stronger alphas (theme-tuned via --yr-*), only the dominant flow (no red-over-
 * blue mud), and √-scaled intensity with a floor so an ordinary spend still shows
 * in a month whose max is one big salary day.
 */
function yearCellStyle(data: CellData | undefined, maxFlow: number): CSSProperties {
  if (!data || (!data.mood && data.income + data.expense === 0)) return {};
  const layers: string[] = [];
  const spendHeavier = data.expense >= data.income;
  const flow = spendHeavier ? data.expense : data.income;
  if (flow > 0) {
    const level = maxFlow > 0 ? Math.sqrt(Math.min(1, flow / maxFlow)) : 1;
    const rgb = spendHeavier ? "var(--c-expense)" : "var(--c-saving)";
    const c = `rgb(${rgb} / calc(var(--yr-floor) + var(--yr-span) * ${level.toFixed(3)}))`;
    layers.push(`linear-gradient(${c},${c})`);
  }
  if (data.mood) layers.push(`rgb(${hexToRgb(moodPreset(data.mood).color)} / var(--yr-mood))`);
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

  // Week + month fit the phone screen exactly (see .cal-fit); the 12-month year
  // view is too tall for that and scrolls normally.
  const fit = range !== "year";

  return (
    <div className={cn("flex flex-col px-4 pb-3 pt-4 sm:px-6 lg:block lg:px-8 lg:py-6", fit && "cal-fit")}>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 lg:mb-6">
        <div>
          <div className="label mb-1 lg:mb-2">
            Calendar · {loading ? "loading…" : `${summary.count} active days`}
          </div>
          {/* Scales with screen height on phones so short screens keep room for the grid. */}
          <h1 className="font-display text-[length:clamp(2rem,5.6vh,3rem)] font-semibold leading-none tracking-tight text-ink sm:text-6xl">
            {period.label}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs sm:text-sm lg:mt-3">
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

        {/* One row on phones: range tabs left, prev / today / next right. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex gap-0.5 rounded-xl border border-line bg-ink/[0.02] p-1 sm:gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                  setCursor(new Date());
                }}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors duration-200 sm:px-3",
                  range === r ? "seg-on text-amber" : "text-ink/45 hover:text-ink/75",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
            <button
              onClick={goPrev}
              aria-label="Previous"
              className="hairline flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink sm:h-10 sm:w-10"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="hairline h-9 cursor-pointer rounded-xl px-3 font-mono text-xs uppercase tracking-widest text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink sm:h-10 sm:px-4"
            >
              Today
            </button>
            <button
              onClick={goNext}
              aria-label="Next"
              className="hairline flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink sm:h-10 sm:w-10"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-widest text-ink/40 sm:gap-x-5 lg:mb-4">
        <div className="flex items-center gap-2">
          <span className="text-ink/55">Mood</span>
          <div className="h-2.5 w-14 rounded-full bg-linear-to-r from-[#A8322A] via-[#B59A3C] to-[#2E8159] sm:w-28" />
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: "rgb(var(--tint-spend))" }} />
          <span>
            <span className="hidden sm:inline">Heavier </span>spend
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: "rgb(var(--tint-income))" }} />
          <span>
            <span className="hidden sm:inline">Heavier </span>income
          </span>
        </div>
      </div>

      {range === "week" && <WeekView cursor={cursor} byDay={byDay} maxFlow={summary.maxFlow} openEntry={openEntry} />}
      {range === "month" && (
        <MonthGrid cursor={cursor} byDay={byDay} maxFlow={summary.maxFlow} openEntry={openEntry} />
      )}
      {range === "year" && <YearView cursor={cursor} byDay={byDay} openEntry={openEntry} />}
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
    // Below lg the card takes all height left in .cal-fit and the 4–6 week rows
    // split it evenly; on desktop rows keep their fixed minimum height.
    <div className="card flex min-h-0 flex-1 flex-col overflow-hidden lg:block">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-1.5 py-2 font-mono text-[10px] tracking-[0.12em] text-ink/35 sm:px-3 sm:py-2.5 sm:tracking-[0.2em]"
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}
      >
        {days.map((day, i) => {
          const key = toDateKey(day);
          const inMonth = isSameMonth(day, cursor);
          const data = byDay.get(key);
          const today = isToday(day);
          const preset = data?.mood ? moodPreset(data.mood) : null;
          const hasFlow = !!data && (data.income > 0 || data.expense > 0);
          return (
            <motion.button
              key={key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.004, 0.2) }}
              onClick={() => openEntry({ date: key, tab: "money" })}
              style={dayCellStyle(data, maxFlow)}
              className={cn(
                "cal-cell group relative flex cursor-pointer flex-col overflow-hidden border-b border-r border-line p-1 text-left transition-colors duration-150 hover:bg-ink/[0.06]! sm:p-2 lg:min-h-[110px]",
                !inMonth && "opacity-35",
                (i + 1) % 7 === 0 && "border-r-0",
              )}
            >
              <div className="flex items-start justify-between gap-0.5">
                <span
                  className={cn(
                    "font-mono text-[11px] tabular sm:text-xs",
                    today
                      ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber font-semibold text-paper sm:h-6 sm:w-6"
                      : "text-ink/70",
                  )}
                >
                  {format(day, "dd")}
                </span>
                {preset && (
                  <MoodIcon mood={preset.value} className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" strokeWidth={2} />
                )}
              </div>
              {hasFlow && (
                <div className="mt-auto whitespace-nowrap font-mono text-[10px] leading-tight tracking-tight tabular sm:text-[11px] sm:tracking-normal">
                  {/* Roomy cells: separate out / in lines. */}
                  <div className="cal-flow space-y-0.5">
                    {data.expense > 0 && (
                      <div className="text-expense">−{compactCurrency(data.expense).replace(TAKA, TAKA)}</div>
                    )}
                    {data.income > 0 && <div className="text-income">+{compactCurrency(data.income)}</div>}
                  </div>
                  {/* Short cells: one net line (the tint still shows the split). */}
                  <div className={cn("cal-net", data.net >= 0 ? "text-income" : "text-expense")}>
                    {data.net >= 0 ? "+" : ""}
                    {compactCurrency(data.net)}
                  </div>
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
    // Below lg the single week row stretches to the height left in .cal-fit.
    <div className="card flex min-h-0 flex-1 flex-col overflow-hidden lg:block">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-1.5 py-2 font-mono text-[10px] tracking-[0.12em] text-ink/35 sm:px-3 sm:py-2.5 sm:tracking-[0.2em]"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7">
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
                "group flex cursor-pointer flex-col overflow-hidden border-r border-line p-1.5 text-left transition-colors duration-150 hover:bg-ink/[0.06]! sm:p-3 lg:min-h-[200px]",
                i === 6 && "border-r-0",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span
                  className={cn(
                    "font-mono text-xs tabular sm:text-sm",
                    today
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-amber font-semibold text-paper sm:h-7 sm:w-7"
                      : "text-ink/75",
                  )}
                >
                  {format(day, "dd")}
                </span>
                {preset && <MoodIcon mood={preset.value} className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />}
              </div>
              <div className="mt-auto space-y-1 whitespace-nowrap font-mono text-[10px] tracking-tight tabular sm:text-xs sm:tracking-normal">
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
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
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
          <div key={mDate.getMonth()} className="card p-2 sm:p-3">
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
                    style={yearCellStyle(data, maxFlow)}
                    title={
                      data
                        ? `${format(day, "MMM d")} · spent ${compactCurrency(data.expense)} · earned ${compactCurrency(data.income)}${data.mood ? ` · mood ${data.mood}/5` : ""}`
                        : format(day, "MMM d")
                    }
                    className={cn(
                      "flex aspect-square cursor-pointer items-center justify-center rounded-[3px] font-mono text-[9px] tabular transition-shadow hover:ring-1 hover:ring-ink/50",
                      !inMonth && "opacity-25",
                      today && "ring-2 ring-inset ring-amber hover:ring-2 hover:ring-amber",
                      !data && "bg-ink/[0.04]",
                    )}
                  >
                    <span className={data ? "font-medium text-ink" : "text-ink/45"}>{format(day, "d")}</span>
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
