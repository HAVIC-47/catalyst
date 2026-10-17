"use client";

// One page for both board kinds: To-do (tasks) and To buy (shopping lists). Same
// Jira-style UI — boards, status columns, tickets you drag across.
import { useState, type FormEvent } from "react";
import { ListTodo, Pencil, Plus, ScanText, ShoppingCart, Trash2, type LucideIcon } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { DEFAULT_BOARD_COLUMNS, type BoardKind } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";
import { Menu } from "@/components/ui/menu";
import { BoardView, NameInput, boardError, ticketNoun } from "@/components/boards/board-view";
import { TicketModal } from "@/components/boards/ticket-modal";
import { AiInsights } from "@/components/ai/ai-insights";
import { tr, digits } from "@/lib/i18n";

const BOARD_COPY: Record<
  BoardKind,
  { kicker: string; title: string; accent: string; icon: LucideIcon; board: string; intro: string; placeholder: string; suggested: string }
> = {
  todo: {
    kicker: "To-do",
    title: "Get it",
    accent: "done.",
    icon: ListTodo,
    board: "board",
    intro: "Make a board for anything you're working on — home, work, a trip. Add tickets, then drag them across as they go from to do to done.",
    placeholder: "Board name (e.g. Home, Work)",
    suggested: "My tasks",
  },
  shopping: {
    kicker: "To buy",
    title: "Things to",
    accent: "buy.",
    icon: ShoppingCart,
    board: "list",
    intro: "Make a list for each shop or occasion. Add what you need with a price, then drag items to In cart and Bought as you shop.",
    placeholder: "List name (e.g. Groceries, Eid)",
    suggested: "Groceries",
  },
};

/** Each kind's words, in the app's language (read on every render). */
export function boardCopy(kind: BoardKind) {
  const c = BOARD_COPY[kind];
  return {
    ...c,
    kicker: tr(c.kicker),
    title: tr(c.title),
    accent: tr(c.accent),
    board: tr(c.board),
    intro: tr(c.intro),
    placeholder: tr(c.placeholder),
    suggested: tr(c.suggested),
  };
}

export function BoardPage({ kind }: { kind: BoardKind }) {
  const { boards, boardColumns, tickets, loading, renameBoard, removeBoard, selectedBoards, selectBoard, openListScan } =
    useAppData();
  const copy = boardCopy(kind);
  const mine = boards.filter((b) => b.kind === kind);

  // The board you last opened, per kind (this browser only) — the list scanner
  // adds to the same one.
  const choose = (id: string) => selectBoard(kind, id);
  const board = mine.find((b) => b.id === selectedBoards[kind]) ?? mine[0] ?? null;

  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState("");

  const columns = board ? boardColumns.filter((c) => c.boardId === board.id).sort((a, b) => a.sort - b.sort) : [];
  const doneColumn = columns.length > 1 ? columns[columns.length - 1].id : null;
  const items = board ? tickets.filter((t) => t.boardId === board.id) : [];
  const open = items.filter((t) => t.columnId !== doneColumn);
  const stats =
    kind === "shopping"
      ? `${tr("{n} to get", { n: open.length })}${open.some((t) => t.amount) ? ` · ${formatCurrency(open.reduce((s, t) => s + (t.amount ?? 0), 0))}` : ""}`
      : tr("{open} open · {done} done", { open: open.length, done: items.length - open.length });

  const remove = () => {
    if (!board) return;
    const n = items.length;
    const what = n ? ` and its ${n} ${ticketNoun(kind, n)}` : "";
    if (!window.confirm(tr("Delete \"{name}\"{what}? This can't be undone.", { name: board.name, what }))) return;
    setError("");
    removeBoard(board.id).catch((err) => setError(boardError(err)));
  };

  const showNew = creating || (!loading && mine.length === 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <div className="label mb-2">
          {copy.kicker} · {digits(String(mine.length))} {copy.board}
          {mine.length === 1 ? "" : "s"}
        </div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {copy.title} <span className="serif-italic text-amber/90">{copy.accent}</span>
        </h1>
      </div>

      <AiInsights topics={[kind]} defaultOpen={false} className="mb-4" />

      {/* Board switcher */}
      {mine.length > 0 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {mine.map((b) => {
            const on = b.id === board?.id;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={on}
                onClick={() => choose(b.id)}
                className={cn(
                  "min-h-[36px] max-w-[60vw] shrink-0 cursor-pointer truncate rounded-full border px-3.5 text-sm transition-colors duration-200",
                  on ? "border-amber/40 bg-amber/[0.08] text-amber" : "border-line text-ink/60 hover:bg-ink/[0.04] hover:text-ink",
                )}
              >
                {b.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 text-sm text-ink/55 transition-colors hover:border-ink/30 hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {tr("New")}{" "}{copy.board}
          </button>
        </div>
      )}

      {showNew && (
        <NewBoard
          kind={kind}
          first={mine.length === 0}
          onDone={(id) => {
            setCreating(false);
            if (id) choose(id);
          }}
        />
      )}

      {board && (
        <>
          <div className="mb-3 flex min-h-[40px] items-center gap-3">
            {renaming ? (
              <NameInput
                initial={board.name}
                label={tr("Rename {board}", { board: copy.board })}
                onDone={(v) => {
                  setRenaming(false);
                  if (v && v !== board.name) renameBoard(board.id, v).catch((err) => setError(boardError(err)));
                }}
                className="max-w-sm font-display text-2xl"
              />
            ) : (
              <h2 className="min-w-0 truncate font-display text-2xl font-semibold text-ink">{board.name}</h2>
            )}
            <span className="shrink-0 font-mono text-xs text-ink/45">{stats}</span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* Computers: add from a screenshot here. Phones use the + in the bottom bar. */}
              <button
                type="button"
                onClick={() => openListScan(kind)}
                className="hairline hidden min-h-[36px] cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium text-ink/75 transition-colors hover:bg-ink/[0.04] hover:text-ink lg:inline-flex"
              >
                <ScanText className="h-4 w-4" aria-hidden />
                {tr("Scan a list")}
              </button>
              <Menu
                label={tr("{name} options", { name: board.name })}
                items={[
                  { label: tr("Rename {board}", { board: copy.board }), icon: Pencil, onSelect: () => setRenaming(true) },
                  { label: tr("Delete {board}", { board: copy.board }), icon: Trash2, onSelect: remove, danger: true },
                ]}
              />
            </div>
          </div>
          <p className="-mt-1 mb-3 text-xs text-ink/45 lg:hidden">
            {tr("Tip: tap ")}
            <span className="font-semibold text-ink/70">+</span>
            {tr(" below to add {x0} from a screenshot of your notes.", { x0: ticketNoun(kind, 2) })}
          </p>
          {error && (
            <p role="alert" className="mb-3 text-sm text-expense">
              {error}
            </p>
          )}
          <BoardView board={board} onOpen={setOpenTicket} />
        </>
      )}

      {loading && <p className="mt-4 text-center font-mono text-xs text-ink/30">{tr("Loading…")}</p>}

      <TicketModal ticketId={openTicket} onClose={() => setOpenTicket(null)} />
    </div>
  );
}

function NewBoard({ kind, first, onDone }: { kind: BoardKind; first: boolean; onDone: (boardId: string | null) => void }) {
  const { createBoard, openListScan } = useAppData();
  const copy = boardCopy(kind);
  const Icon = copy.icon;
  const [name, setName] = useState(first ? copy.suggested : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError("");
    try {
      const { board } = await createBoard(n, kind);
      onDone(board.id);
    } catch (err) {
      setError(boardError(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mb-5 p-5 sm:p-6">
      {first ? (
        <>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-ink/[0.02]">
            <Icon className="h-5 w-5 text-amber" aria-hidden />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink">{tr("Start your first {board}", { board: copy.board })}</h2>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-ink/50">{copy.intro}</p>
        </>
      ) : (
        <div className="label">{tr("New {board}", { board: copy.board })}</div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          autoFocus={!first}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.name}
          placeholder={copy.placeholder}
          aria-label={tr("{board} name", { board: copy.board })}
          className="min-h-[44px] min-w-0 flex-1 basis-56 rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden placeholder:text-ink/30 focus:border-amber/50"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:cursor-default disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          {tr("Create")}
        </button>
        {!first && (
          <button
            type="button"
            onClick={() => onDone(null)}
            className="min-h-[44px] cursor-pointer rounded-xl px-4 text-sm text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            {tr("Cancel")}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink/40">
        {tr("Starts with {columns} — rename them or add more any time.", { columns: DEFAULT_BOARD_COLUMNS[kind].map((c) => tr(c)).join(" · ") })}
      </p>
      {first && (
        <button
          type="button"
          onClick={() => openListScan(kind)}
          className="mt-4 inline-flex min-h-[40px] cursor-pointer items-center gap-2 text-sm font-medium text-amber/90 transition-colors hover:text-amber"
        >
          <ScanText className="h-4 w-4" aria-hidden />
          {tr("Or start from a screenshot of your list")}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-expense">
          {error}
        </p>
      )}
    </form>
  );
}
