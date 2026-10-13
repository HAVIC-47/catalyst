// Ordering helpers for board tickets (shared by the store and the board UI).
import type { Ticket } from "@/types";

export const SORT_STEP = 1024;

/**
 * A sort value between two neighbours (either may be missing). null when they
 * are too close to split — renumber the column instead.
 */
export function sortBetween(prev: number | undefined, next: number | undefined): number | null {
  if (prev === undefined && next === undefined) return SORT_STEP;
  if (prev === undefined) return next! - SORT_STEP;
  if (next === undefined) return prev + SORT_STEP;
  const mid = (prev + next) / 2;
  return next - prev > 1e-6 && mid > prev && mid < next ? mid : null;
}

/** Column order: sort, then ticket number for rows that share a sort. */
export const byTicketOrder = (a: Ticket, b: Ticket) => a.sort - b.sort || a.number - b.number;
