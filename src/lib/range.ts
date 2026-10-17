// Shared time-window helpers for dashboard charts (donuts, bars, trends).
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { toDateKey, fmt } from "@/lib/utils";

export type Range = "day" | "week" | "month" | "year";
export const RANGES: Range[] = ["day", "week", "month", "year"];

export function rangeWindow(
  range: Range,
  offset: number,
): { startKey: string; endKey: string; label: string } {
  const now = new Date();
  if (range === "day") {
    const d = addDays(now, offset);
    const k = toDateKey(d);
    return { startKey: k, endKey: k, label: fmt(d, "EEE, MMM d") };
  }
  if (range === "week") {
    const a = addWeeks(now, offset);
    return {
      startKey: toDateKey(startOfWeek(a)),
      endKey: toDateKey(endOfWeek(a)),
      label: `${fmt(startOfWeek(a), "MMM d")} – ${fmt(endOfWeek(a), "MMM d")}`,
    };
  }
  if (range === "month") {
    const a = addMonths(now, offset);
    return {
      startKey: toDateKey(startOfMonth(a)),
      endKey: toDateKey(endOfMonth(a)),
      label: fmt(a, "MMMM yyyy"),
    };
  }
  const a = addYears(now, offset);
  return {
    startKey: toDateKey(startOfYear(a)),
    endKey: toDateKey(endOfYear(a)),
    label: fmt(a, "yyyy"),
  };
}

/** True if a yyyy-mm-dd date key falls inside [startKey, endKey]. */
export function inRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}
