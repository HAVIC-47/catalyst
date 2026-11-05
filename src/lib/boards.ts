// Ordering helpers for board tickets (shared by the store and the board UI).
import type { Board, BoardColumn, Ticket } from "@/types";

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

/** Where an item on a to-buy list counts as bought: the list's last column, the
 *  one its cards are struck through in. Null for to-do boards and one-column lists. */
export function boughtColumn(board: Pick<Board, "id" | "kind"> | undefined, columns: BoardColumn[]): string | null {
  if (board?.kind !== "shopping") return null;
  const mine = columns.filter((c) => c.boardId === board.id).sort((a, b) => a.sort - b.sort);
  return mine.length > 1 ? mine[mine.length - 1].id : null;
}

/** Column order: sort, then ticket number for rows that share a sort. */
export const byTicketOrder = (a: Ticket, b: Ticket) => a.sort - b.sort || a.number - b.number;
