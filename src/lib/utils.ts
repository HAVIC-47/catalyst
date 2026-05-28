import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Bangladeshi Taka. Uses the ৳ symbol with en-IN grouping (1,00,000 style). */
export const TAKA = "৳";

export function formatCurrency(value: number, opts: { sign?: boolean } = {}): string {
  const sign = value > 0 ? (opts.sign ? "+" : "") : value < 0 ? "−" : "";
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(Math.abs(value));
  return `${sign}${TAKA}${formatted}`;
}

export function compactCurrency(value: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return `${value < 0 ? "−" : ""}${TAKA}${formatted}`;
}

/** yyyy-mm-dd in local time (avoids UTC off-by-one from toISOString). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
