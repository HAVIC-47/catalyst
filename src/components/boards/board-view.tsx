"use client";

// The board: columns side by side (swipe between them on a phone) with tickets
// you drag within and across columns — mouse, touch (press and hold, so a quick
// swipe still scrolls) or keyboard (space to pick up, arrows to move, space to
// drop). Enter or a tap opens a ticket. Columns move the same way, by their title.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  useDndContext,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import type { Board, BoardColumn, BoardKind, Ticket } from "@/types";
import { byTicketOrder } from "@/lib/boards";
import { cn, formatCurrency } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";
import { Menu } from "@/components/ui/menu";
import { TicketCard } from "@/components/boards/ticket-card";

type Lists = Record<string, string[]>; // column id -> ticket ids, top to bottom

export const ticketNoun = (kind: BoardKind, n = 1) => (kind === "shopping" ? "item" : "ticket") + (n === 1 ? "" : "s");

/** A Supabase error as a sentence (with a hint when the boards tables are missing). */
export function boardError(err: unknown): string {
  const msg = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err);
  if (/(board|ticket).*(does not exist|schema cache)/i.test(msg)) return "Boards aren't set up yet — run db/supabase.sql in Supabase.";
  return msg || "Something went wrong — try again.";
}

const COLUMN_W = "w-[84vw] max-w-[320px] sm:w-[288px]";

type Typed = { data: { current?: { type?: string } } };
const isColumn = (x: Typed) => x.data.current?.type === "column";

// A ticket goes to the column it's held over sideways — columns are only as tall
// as their cards, so this still works below a short column's last card — and then
// lands among that column's cards.
const ticketCollisions: CollisionDetection = (args) => {
  const { droppableContainers, droppableRects, pointerCoordinates, collisionRect } = args;
  const x = pointerCoordinates?.x ?? collisionRect.left + collisionRect.width / 2;
  let column: UniqueIdentifier | null = null;
  let nearest = Infinity;
  for (const c of droppableContainers) {
    const r = isColumn(c) ? droppableRects.get(c.id) : undefined;
    if (!r) continue;
    const off = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    if (off < nearest) {
      nearest = off;
      column = c.id;
    }
  }
  if (column === null) return closestCorners(args);
  const inside = droppableContainers.filter((c) => c.id === column || c.data.current?.sortable?.containerId === column);
  return closestCorners({ ...args, droppableContainers: inside });
};

// A dragged column only lands among columns; a ticket among its column's cards.
const collisions: CollisionDetection = (args) =>
  isColumn(args.active)
    ? closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(isColumn) })
    : ticketCollisions(args);

// Arrow keys move a column to the next column, not into the tickets inside it.
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const all = args.context.droppableContainers;
  if (!args.context.active || !isColumn(args.context.active)) return sortableKeyboardCoordinates(event, args);
  const columnsOnly = { getEnabled: () => all.getEnabled().filter(isColumn), get: (id: UniqueIdentifier) => all.get(id) } as typeof all;
  return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableContainers: columnsOnly } });
};

export function BoardView({ board, onOpen }: { board: Board; onOpen: (ticketId: string) => void }) {
  const { boardColumns, tickets, placeTicket, placeColumn } = useAppData();
  const columns = useMemo(
    () => boardColumns.filter((c) => c.boardId === board.id).sort((a, b) => a.sort - b.sort),
    [boardColumns, board.id],
  );
  const byId = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);
  const stored = useMemo<Lists>(() => {
    const lists: Lists = Object.fromEntries(columns.map((c) => [c.id, [] as string[]]));
    for (const t of [...tickets].sort(byTicketOrder)) lists[t.columnId]?.push(t.id);
    return lists;
  }, [columns, tickets]);

  // While dragging, the board shows a working copy (cards hop between columns as
  // you hover); on drop the move is saved and the stored order takes over again.
  const drag = useRef<Lists | null>(null);
  const [dragLists, setDragLists] = useState<Lists | null>(null);
  const setDrag = (l: Lists | null) => {
    drag.current = l;
    setDragLists(l);
  };
  const lists = dragLists ?? stored;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const droppedAt = useRef(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    // Space picks up and drops; Enter stays free to open the ticket.
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const columnOf = (id: UniqueIdentifier, src: Lists) => {
    const k = String(id);
    return k in src ? k : Object.keys(src).find((c) => src[c].includes(k));
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setError("");
    if (isColumn(active)) {
      setActiveColumnId(String(active.id));
      return;
    }
    setActiveId(String(active.id));
    setDrag(stored);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (isColumn(active)) return; // the sortable strategy slides the columns
    const cur = drag.current ?? stored;
    if (!over) return;
    const from = columnOf(active.id, cur);
    const to = columnOf(over.id, cur);
    if (!from || !to || from === to) return;
    const id = String(active.id);
    const target = cur[to];
    const overIndex = target.indexOf(String(over.id));
    // Over a card: land above it, or below once the dragged card is past its middle.
    const rect = active.rect.current.translated;
    const below = !!rect && overIndex >= 0 && rect.top > over.rect.top + over.rect.height / 2;
    const at = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
    setDrag({ ...cur, [from]: cur[from].filter((x) => x !== id), [to]: [...target.slice(0, at), id, ...target.slice(at)] });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (isColumn(active)) {
      setActiveColumnId(null);
      const from = columns.findIndex((c) => c.id === active.id);
      const to = over ? columns.findIndex((c) => c.id === over.id) : -1;
      // placeColumn updates the store right away, so the column stays where it landed.
      if (from >= 0 && to >= 0 && from !== to) placeColumn(String(active.id), to).catch((err) => setError(boardError(err)));
      return;
    }
    const cur = drag.current ?? stored;
    const id = String(active.id);
    const ticket = byId.get(id);
    const to = columnOf(id, cur);
    setActiveId(null);
    droppedAt.current = Date.now();
    if (over && to && ticket) {
      let order = cur[to];
      const overId = String(over.id);
      if (overId !== id && columnOf(overId, cur) === to) {
        const from = order.indexOf(id);
        const at = overId === to ? order.length - 1 : order.indexOf(overId);
        if (at >= 0 && from !== at) order = arrayMove(order, from, at);
      }
      const moved = ticket.columnId !== to || (stored[to] ?? []).indexOf(id) !== order.indexOf(id);
      // placeTicket updates the store right away, so the card stays where it landed.
      if (moved) void placeTicket(id, to, order);
    }
    setDrag(null);
  };

  const onDragCancel = () => {
    setActiveId(null);
    setActiveColumnId(null);
    setDrag(null);
  };

  // A tap that ends a drag isn't an "open".
  const open = (id: string) => {
    if (Date.now() - droppedAt.current > 300) onOpen(id);
  };

  const titleOf = (id: UniqueIdentifier) => byId.get(String(id))?.title ?? "the ticket";
  const placeOf = (id: UniqueIdentifier) =>
    columns.find((c) => c.id === columnOf(id, drag.current ?? stored))?.name ?? "the board";
  const nameOf = (a: Active) => `the ${columns.find((c) => c.id === a.id)?.name ?? ""} column`;
  const slotOf = (id: UniqueIdentifier) => `position ${columns.findIndex((c) => c.id === id) + 1} of ${columns.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => (isColumn(active) ? `Picked up ${nameOf(active)}.` : `Picked up ${titleOf(active.id)}.`),
    onDragOver: ({ active, over }) =>
      isColumn(active)
        ? over
          ? `${nameOf(active)} is at ${slotOf(over.id)}.`
          : `${nameOf(active)} is not over a column.`
        : over
          ? `${titleOf(active.id)} is in ${placeOf(over.id)}.`
          : `${titleOf(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      isColumn(active)
        ? over
          ? `${nameOf(active)} was dropped at ${slotOf(over.id)}.`
          : `${nameOf(active)} was put back.`
        : over
          ? `${titleOf(active.id)} was dropped in ${placeOf(over.id)}.`
          : `${titleOf(active.id)} was put back.`,
    onDragCancel: ({ active }) =>
      isColumn(active) ? `Moving ${nameOf(active)} was cancelled.` : `Moving ${titleOf(active.id)} was cancelled.`,
  };

  const active = activeId ? byId.get(activeId) : undefined;
  const activeColumn = activeColumnId ? columns.find((c) => c.id === activeColumnId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisions}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move it, press space, use the arrow keys, then press space to drop it or escape to cancel. Press enter to open a ticket.",
        },
      }}
    >
      {/* Snapping makes swiping between columns land cleanly; it's off mid-drag so
          auto-scroll at the edges can glide. */}
      {error && (
        <p role="alert" className="mb-2 text-xs text-expense">
          {error}
        </p>
      )}
      <div
        className={cn(
          // items-start: each column is only as tall as its own cards, so a short
          // column's "Add" stays right under its last card.
          "-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
          !activeId && !activeColumnId && "snap-x snap-mandatory scroll-px-4 sm:snap-none",
        )}
      >
        <SortableContext id={`columns-${board.id}`} items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          {columns.map((c, i) => (
            <ColumnView
              key={c.id}
              column={c}
              ids={lists[c.id] ?? []}
              byId={byId}
              kind={board.kind}
              done={columns.length > 1 && i === columns.length - 1}
              first={i === 0}
              last={i === columns.length - 1}
              onOpen={open}
              dragging={!!activeId}
            />
          ))}
        </SortableContext>
        <AddColumn boardId={board.id} />
      </div>

      {mounted &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
            {/* dnd-kit measures this wrapper; the tilt stays on the card inside so the
                measured box isn't skewed (keyboard moves compare left/top edges). */}
            {active ? (
              <div>
                <TicketCard ticket={active} kind={board.kind} done={false} lifted />
              </div>
            ) : activeColumn ? (
              <div>
                <ColumnPreview
                  column={activeColumn}
                  items={(lists[activeColumn.id] ?? []).map((id) => byId.get(id)).filter((t): t is Ticket => !!t)}
                  kind={board.kind}
                />
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

function ColumnView({
  column,
  ids,
  byId,
  kind,
  done,
  first,
  last,
  onOpen,
  dragging,
}: {
  column: BoardColumn;
  ids: string[];
  byId: Map<string, Ticket>;
  kind: BoardKind;
  done: boolean;
  first: boolean;
  last: boolean;
  onOpen: (id: string) => void;
  dragging: boolean;
}) {
  const { renameColumn, moveColumn, removeColumn } = useAppData();
  // The whole column is the drop zone for tickets; only its title picks it up.
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column" },
  });
  const { active } = useDndContext();
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState("");
  const items = ids.map((id) => byId.get(id)).filter((t): t is Ticket => !!t);
  const total = kind === "shopping" ? items.reduce((s, t) => s + (t.amount ?? 0), 0) : 0;
  // The column the dragged card is in right now.
  const target = !!active && ids.includes(String(active.id));

  const run = (p: Promise<unknown>) => {
    setError("");
    p.catch((err) => setError(boardError(err)));
  };
  const remove = () => {
    if (items.length && !window.confirm(`Delete "${column.name}" and its ${items.length} ${ticketNoun(kind, items.length)}?`)) return;
    run(removeColumn(column.id));
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex shrink-0 snap-start flex-col rounded-xl border bg-ink/[0.025] transition-colors duration-150",
        COLUMN_W,
        target ? "border-amber/40" : "border-line",
        isDragging && "opacity-35",
      )}
    >
      <header className="flex min-h-[46px] items-center gap-2 py-1.5 pl-3 pr-1.5">
        {renaming ? (
          <>
            <NameInput
              initial={column.name}
              label="Column name"
              onDone={(v) => {
                setRenaming(false);
                if (v && v !== column.name) run(renameColumn(column.id, v));
              }}
              className="font-mono text-[11px] uppercase tracking-[0.16em]"
            />
            <ColumnStats count={items.length} total={total} />
          </>
        ) : (
          // The title is the column's handle: drag it with the mouse, press and hold
          // on touch, or focus it and press space.
          <div
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`${column.name} column`}
            title="Drag to move this column"
            className="-my-1 -ml-1 flex min-h-[38px] min-w-0 flex-1 cursor-grab touch-manipulation select-none items-center gap-2 rounded-md pl-1 [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing"
          >
            <h3 className="min-w-0 truncate font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink/70">
              {column.name}
            </h3>
            <ColumnStats count={items.length} total={total} />
          </div>
        )}
        <Menu
          label={`${column.name} column options`}
          className="ml-auto"
          items={[
            { label: "Rename", icon: Pencil, onSelect: () => setRenaming(true) },
            { label: "Move left", icon: ArrowLeft, onSelect: () => run(moveColumn(column.id, -1)), disabled: first },
            { label: "Move right", icon: ArrowRight, onSelect: () => run(moveColumn(column.id, 1)), disabled: last },
            { label: "Delete column", icon: Trash2, onSelect: remove, danger: true },
          ]}
        />
      </header>
      {error && (
        <p role="alert" className="mx-3 mb-2 text-xs text-expense">
          {error}
        </p>
      )}

      <SortableContext id={column.id} items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-[72px] flex-1 flex-col gap-2 px-2 pb-1">
          {items.map((t) => (
            <SortableTicket key={t.id} ticket={t} kind={kind} done={done} onOpen={onOpen} dragging={dragging} />
          ))}
          {items.length === 0 && !dragging && (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line px-3 py-5 text-center text-xs text-ink/35">
              {first ? `Add a ${ticketNoun(kind)} below` : "Drag here"}
            </li>
          )}
        </ul>
      </SortableContext>

      <QuickAdd columnId={column.id} kind={kind} />
    </section>
  );
}

function SortableTicket({
  ticket,
  kind,
  done,
  onOpen,
  dragging,
}: {
  ticket: Ticket;
  kind: BoardKind;
  done: boolean;
  onOpen: (id: string) => void;
  dragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: { type: "ticket" },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("list-none", isDragging && "opacity-35")}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`${ticket.title}, number ${ticket.number}`}
        onClick={() => onOpen(ticket.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !dragging) {
            e.preventDefault();
            onOpen(ticket.id);
            return;
          }
          listeners?.onKeyDown?.(e);
        }}
        className="cursor-grab touch-manipulation select-none rounded-lg [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing"
      >
        <TicketCard ticket={ticket} kind={kind} done={done} />
      </div>
    </li>
  );
}

function ColumnStats({ count, total }: { count: number; total: number }) {
  return (
    <>
      <span className="shrink-0 rounded-full bg-ink/[0.06] px-1.5 font-mono text-[10px] leading-4 text-ink/55">{count}</span>
      {total > 0 && <span className="shrink-0 font-mono text-[11px] tabular text-ink/55">{formatCurrency(total)}</span>}
    </>
  );
}

/** The column under your finger while it's being moved (a still copy, slightly lifted). */
function ColumnPreview({ column, items, kind }: { column: BoardColumn; items: Ticket[]; kind: BoardKind }) {
  const total = kind === "shopping" ? items.reduce((s, t) => s + (t.amount ?? 0), 0) : 0;
  return (
    <section
      className={cn(
        "flex rotate-[1.5deg] cursor-grabbing flex-col rounded-xl border border-amber/40 bg-card shadow-card",
        COLUMN_W,
      )}
    >
      <header className="flex min-h-[46px] items-center gap-2 py-1.5 pl-3 pr-3">
        <h3 className="min-w-0 truncate font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink/70">
          {column.name}
        </h3>
        <ColumnStats count={items.length} total={total} />
      </header>
      <ul className="flex flex-col gap-2 px-2 pb-3">
        {items.slice(0, 6).map((t) => (
          <li key={t.id} className="list-none">
            <TicketCard ticket={t} kind={kind} done={false} />
          </li>
        ))}
        {items.length > 6 && <li className="list-none px-1 text-xs text-ink/45">+{items.length - 6} more</li>}
      </ul>
    </section>
  );
}

/** "+ Add ticket" at the foot of a column; stays open for quick runs of entries. */
function QuickAdd({ columnId, kind }: { columnId: string; kind: BoardKind }) {
  const { createTicket } = useAppData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setTitle("");
    setError("");
  };
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setError("");
    try {
      await createTicket(columnId, { title: t });
      setTitle("");
    } catch (err) {
      setError(boardError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-2 mb-2 flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm text-ink/45 transition-colors hover:bg-ink/[0.04] hover:text-ink/80"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add {ticketNoun(kind)}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="px-2 pb-2">
      <textarea
        autoFocus
        rows={2}
        value={title}
        maxLength={LIMITS.title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") close();
        }}
        onBlur={() => !title.trim() && !busy && close()}
        placeholder={kind === "shopping" ? "What do you need?" : "What needs doing?"}
        aria-label={`New ${ticketNoun(kind)}`}
        className="w-full resize-none rounded-lg border border-line bg-card p-2.5 text-sm text-ink outline-hidden placeholder:text-ink/30 focus:border-amber/50"
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-expense">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim() || busy}
          className="entry-btn min-h-[36px] cursor-pointer rounded-lg px-3.5 text-xs font-semibold text-paper disabled:cursor-default disabled:opacity-40"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={close}
          className="min-h-[36px] cursor-pointer rounded-lg px-3 text-xs text-ink/55 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddColumn({ boardId }: { boardId: string }) {
  const { createColumn } = useAppData();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  // After a failed save the field comes back (new key) with the name still in it.
  const [draft, setDraft] = useState({ key: 0, name: "" });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-12 shrink-0 cursor-pointer snap-start items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm text-ink/45 transition-colors hover:border-ink/30 hover:text-ink/75",
          COLUMN_W,
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add column
      </button>
    );
  }
  return (
    <div className={cn("h-fit shrink-0 snap-start rounded-xl border border-dashed border-line p-3", COLUMN_W)}>
      <NameInput
        key={draft.key}
        initial={draft.name}
        label="New column name"
        placeholder="Column name (e.g. Waiting)"
        onDone={(v) => {
          if (!v) {
            setError("");
            setDraft({ key: draft.key + 1, name: "" });
            return setOpen(false);
          }
          setError("");
          createColumn(boardId, v)
            .then(() => {
              setDraft({ key: draft.key + 1, name: "" });
              setOpen(false);
            })
            .catch((err) => {
              setError(boardError(err));
              setDraft({ key: draft.key + 1, name: v });
            });
        }}
        className="min-h-[40px] w-full text-sm"
      />
      {error && (
        <p role="alert" className="mt-2 text-xs text-expense">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-ink/40">Enter to add · Esc to cancel</p>
    </div>
  );
}

/** Inline name field: Enter or leaving the field saves, Escape cancels (onDone(null)). */
export function NameInput({
  initial,
  label,
  placeholder,
  onDone,
  className,
}: {
  initial: string;
  label: string;
  placeholder?: string;
  onDone: (value: string | null) => void;
  className?: string;
}) {
  const [v, setV] = useState(initial);
  const finished = useRef(false);
  const finish = (value: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(value);
  };
  return (
    <input
      autoFocus
      value={v}
      maxLength={LIMITS.name}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => finish(v.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(v.trim());
        if (e.key === "Escape") finish(null);
      }}
      className={cn(
        "min-w-0 flex-1 rounded-md border border-amber/50 bg-card px-2 py-1 text-ink outline-hidden placeholder:text-ink/30 placeholder:normal-case placeholder:tracking-normal",
        className,
      )}
    />
  );
}
