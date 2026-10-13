import { createClient } from "@/lib/supabase/client";
import type { Board, BoardColumn, BoardKind, NewTicket, Ticket, TicketPriority } from "@/types";

interface BRow {
  id: string;
  name: string;
  kind: BoardKind;
  sort: number;
}
const toBoard = (r: BRow): Board => ({ id: r.id, name: r.name, kind: r.kind, sort: r.sort });

interface CRow {
  id: string;
  board_id: string;
  name: string;
  sort: number;
}
const toColumn = (r: CRow): BoardColumn => ({ id: r.id, boardId: r.board_id, name: r.name, sort: r.sort });

interface TRow {
  id: string;
  board_id: string;
  column_id: string;
  number: number;
  title: string;
  description: string;
  priority: TicketPriority;
  due_on: string | null;
  amount: number | string | null;
  sort: number;
}
const toTicket = (r: TRow): Ticket => ({
  id: r.id,
  boardId: r.board_id,
  columnId: r.column_id,
  number: r.number,
  title: r.title,
  description: r.description,
  priority: r.priority,
  dueOn: r.due_on,
  amount: r.amount === null ? null : typeof r.amount === "string" ? parseFloat(r.amount) : r.amount,
  sort: r.sort,
});

// ---- boards
export async function listBoards(): Promise<Board[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as BRow[]).map(toBoard);
}

export async function addBoard(input: Omit<Board, "id">): Promise<Board> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .insert({ name: input.name, kind: input.kind, sort: input.sort })
    .select("*")
    .single();
  if (error) throw error;
  return toBoard(data as BRow);
}

export async function updateBoard(id: string, patch: Partial<Pick<Board, "name" | "sort">>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("boards").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBoard(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) throw error;
}

// ---- columns
export async function listBoardColumns(): Promise<BoardColumn[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("board_columns").select("*").order("sort", { ascending: true });
  if (error) throw error;
  return (data as CRow[]).map(toColumn);
}

export async function addBoardColumns(rows: Omit<BoardColumn, "id">[]): Promise<BoardColumn[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("board_columns")
    .insert(rows.map((c) => ({ board_id: c.boardId, name: c.name, sort: c.sort })))
    .select("*");
  if (error) throw error;
  return (data as CRow[]).map(toColumn).sort((a, b) => a.sort - b.sort);
}

export async function updateBoardColumn(id: string, patch: Partial<Pick<BoardColumn, "name" | "sort">>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("board_columns").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBoardColumn(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("board_columns").delete().eq("id", id);
  if (error) throw error;
}

// ---- tickets
export async function listTickets(): Promise<Ticket[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tickets").select("*").order("sort", { ascending: true });
  if (error) throw error;
  return (data as TRow[]).map(toTicket);
}

const ticketRow = (t: Partial<NewTicket>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (t.boardId !== undefined) row.board_id = t.boardId;
  if (t.columnId !== undefined) row.column_id = t.columnId;
  if (t.number !== undefined) row.number = t.number;
  if (t.title !== undefined) row.title = t.title;
  if (t.description !== undefined) row.description = t.description;
  if (t.priority !== undefined) row.priority = t.priority;
  if (t.dueOn !== undefined) row.due_on = t.dueOn;
  if (t.amount !== undefined) row.amount = t.amount;
  if (t.sort !== undefined) row.sort = t.sort;
  return row;
};

export async function addTicket(input: NewTicket): Promise<Ticket> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tickets").insert(ticketRow(input)).select("*").single();
  if (error) throw error;
  return toTicket(data as TRow);
}

/** `undefined` leaves a field alone; `null` clears dueOn / amount. */
export async function updateTicket(id: string, patch: Partial<NewTicket>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tickets").update(ticketRow(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteTicket(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tickets").delete().eq("id", id);
  if (error) throw error;
}
