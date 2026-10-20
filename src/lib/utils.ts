import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { bn as bnDates } from "date-fns/locale";
import { currency } from "@/lib/currency";
import { digits, isBangla } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** The Bangladeshi taka sign — the default currency (see lib/currency for the chosen one). */
export const TAKA = "৳";

/** The account currency's sign, for amount inputs and labels (৳ unless changed in Settings). */
export function currencySymbol(): string {
  return currency().symbol.trim();
}

/** An amount in the account's currency: ৳1,25,000 by default (en-IN grouping), $125,000 for dollars. */
export function formatCurrency(value: number, opts: { sign?: boolean } = {}): string {
  const c = currency();
  const sign = value > 0 ? (opts.sign ? "+" : "") : value < 0 ? "−" : "";
  const formatted = new Intl.NumberFormat(c.locale, {
    maximumFractionDigits: value % 1 === 0 ? 0 : c.decimals,
  }).format(Math.abs(value));
  return digits(`${sign}${c.symbol}${formatted}`);
}

export function compactCurrency(value: number): string {
  const c = currency();
  const formatted = new Intl.NumberFormat(c.locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return digits(`${value < 0 ? "−" : ""}${c.symbol}${formatted}`);
}

/** A date as shown, in the app's language (Bengali month names and digits in Bangla). */
export function fmt(date: Date | number, pattern: string): string {
  return isBangla() ? digits(format(date, pattern, { locale: bnDates })) : format(date, pattern);
}

/**
 * A data color (category / mood hex) made readable as text on its own pale tint:
 * pulled toward ink on light paper, left as-is on black. Strength is the
 * --tint-text var in globals.css (100% in dark mode = unchanged).
 */
export function tintText(color: string): string {
  return `color-mix(in srgb, ${vivid(color)} var(--tint-text), rgb(var(--c-ink)))`;
}

/**
 * A stored color (a category's, a wallet's, a tag's) the way the theme wants it:
 * more chroma on light paper so it pops, unchanged on black (--vivid-l / --vivid-c
 * in globals.css). Non-hex values (CSS variables) pass through.
 */
export function vivid(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `oklch(from ${color} calc(l * var(--vivid-l, 1)) calc(c * var(--vivid-c, 1)) h)` : color;
}

/** Any color (hex, rgb(var(--x)), vivid()) at an alpha — for washes and borders. */
export function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

/** yyyy-mm-dd in local time (avoids UTC off-by-one from toISOString). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Combine a yyyy-mm-dd date with an HH:mm time into a local ISO timestamp. */
export function combineDateTime(dateKey: string, time: string): string {
  return new Date(`${dateKey}T${time || "12:00"}:00`).toISOString();
}

/** The current local time as HH:mm. */
export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
