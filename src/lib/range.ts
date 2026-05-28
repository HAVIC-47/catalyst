// Shared time-window helpers for dashboard charts (donuts, bars, trends).
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { toDateKey } from "@/lib/utils";

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
    return { startKey: k, endKey: k, label: format(d, "EEE, MMM d") };
  }
  if (range === "week") {
    const a = addWeeks(now, offset);
    return {
      startKey: toDateKey(startOfWeek(a)),
      endKey: toDateKey(endOfWeek(a)),
      label: `${format(startOfWeek(a), "MMM d")} – ${format(endOfWeek(a), "MMM d")}`,
    };
  }
  if (range === "month") {
    const a = addMonths(now, offset);
    return {
      startKey: toDateKey(startOfMonth(a)),
      endKey: toDateKey(endOfMonth(a)),
      label: format(a, "MMMM yyyy"),
    };
  }
  const a = addYears(now, offset);
  return {
    startKey: toDateKey(startOfYear(a)),
    endKey: toDateKey(endOfYear(a)),
    label: format(a, "yyyy"),
  };
}

/** True if a yyyy-mm-dd date key falls inside [startKey, endKey]. */
export function inRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}
