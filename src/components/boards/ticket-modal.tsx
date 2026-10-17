"use client";

// Ticket editor: title, status (its column), priority, due date, price (to-buy
// boards) and notes. Changing the status puts the ticket at the bottom of that
// column, just like dragging it there.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { TICKET_PRIORITIES, type Ticket } from "@/types";
import { byTicketOrder } from "@/lib/boards";
import { currencySymbol, cn } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";
import { PriorityIcon } from "@/components/boards/ticket-card";
import { boardError, ticketNoun } from "@/components/boards/board-view";
import { tr } from "@/lib/i18n";

export function TicketModal({ ticketId, onClose }: { ticketId: string | null; onClose: () => void }) {
  const { tickets } = useAppData();
  const ticket = ticketId ? tickets.find((t) => t.id === ticketId) : undefined;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!ticket) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ticket, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {ticket && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={tr("Edit {title}", { title: ticket.title })}
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="card relative my-auto w-full max-w-lg overflow-hidden"
          >
            <TicketForm key={ticket.id} ticket={ticket} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function TicketForm({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { boards, boardColumns, tickets, editTicket, placeTicket, removeTicket } = useAppData();
  const board = boards.find((b) => b.id === ticket.boardId);
  const kind = board?.kind ?? "todo";
  const columns = boardColumns.filter((c) => c.boardId === ticket.boardId).sort((a, b) => a.sort - b.sort);

  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [priority, setPriority] = useState(ticket.priority);
  const [dueOn, setDueOn] = useState(ticket.dueOn ?? "");
  const [amount, setAmount] = useState(ticket.amount === null ? "" : String(ticket.amount));
  const [columnId, setColumnId] = useState(ticket.columnId);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const price = amount.trim() === "" ? null : Number(amount);
  const priceOk = price === null || (Number.isFinite(price) && price >= 0 && price < 1e10);
  const valid = !!title.trim() && priceOk;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      await editTicket(ticket.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        dueOn: dueOn || null,
        amount: kind === "shopping" ? (price === null ? null : Math.round(price * 100) / 100) : ticket.amount,
      });
      if (columnId !== ticket.columnId) {
        const order = tickets
          .filter((t) => t.columnId === columnId)
          .sort(byTicketOrder)
          .map((t) => t.id);
        await placeTicket(ticket.id, columnId, [...order, ticket.id]);
      }
      onClose();
    } catch (err) {
      setError(boardError(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await removeTicket(ticket.id);
      onClose();
    } catch (err) {
      setError(boardError(err));
      setBusy(false);
    }
  };

  const field =
    "min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden placeholder:text-ink/30 focus:border-amber/50";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line p-5 pb-4 sm:p-6 sm:pb-5">
        <div className="min-w-0">
          <div className="label truncate">
            #{ticket.number} · {board?.name ?? tr("Board")}
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">{tr("Edit {x}", { x: ticketNoun(kind) })}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("Close")}
          className="cursor-pointer rounded-lg p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <label className="block">
          <span className="label mb-2 block">{tr("Title")}</span>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void save();
              }
            }}
            rows={2}
            maxLength={LIMITS.title}
            className={cn(field, "resize-none py-2.5 text-base")}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label mb-2 block">{tr("Status")}</span>
            <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className={cn(field, "cursor-pointer bg-card")}>
              {columns.map((c) => (
                <option key={c.id} value={c.id} className="bg-card">
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="label mb-2 block">{tr("Priority")}</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label={tr("Priority")}>
              {TICKET_PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={priority === p.value}
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors",
                    priority === p.value
                      ? "border-amber/40 bg-amber/[0.08] text-ink"
                      : "border-line text-ink/55 hover:bg-ink/[0.03] hover:text-ink/80",
                  )}
                >
                  <PriorityIcon priority={p.value} />
                  {tr(`${p.label}|priority`)}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="label mb-2 block">{tr("Due date")}</span>
            <span className="flex items-center gap-2">
              <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={cn(field, "text-ink/80")} />
              {dueOn && (
                <button
                  type="button"
                  onClick={() => setDueOn("")}
                  className="shrink-0 cursor-pointer font-mono text-[11px] uppercase tracking-widest text-amber/80 hover:text-amber"
                >
                  {tr("Clear")}
                </button>
              )}
            </span>
          </label>

          {kind === "shopping" && (
            <label className="block">
              <span className="label mb-2 block">{tr("Price")}</span>
              <span className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
                <span className="font-mono text-ink/40">{currencySymbol()}</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder={tr("Optional")}
                  className="min-h-[42px] w-full min-w-0 bg-transparent font-mono text-sm text-ink outline-hidden placeholder:text-ink/30"
                />
              </span>
            </label>
          )}
        </div>

        <label className="block">
          <span className="label mb-2 block">{tr("Notes")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={LIMITS.description}
            placeholder={kind === "shopping" ? tr("Brand, size, where to get it…") : tr("Details, links, next steps…")}
            className={cn(field, "resize-y py-2.5")}
          />
        </label>

        {error && (
          <p className="rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line p-4">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink/70">{tr("Delete?")}</span>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="min-h-[40px] cursor-pointer rounded-xl border border-expense/40 px-3 text-sm font-medium text-expense transition-colors hover:bg-expense/10 disabled:opacity-40"
            >
              {tr("Delete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-[40px] cursor-pointer rounded-xl px-3 text-sm text-ink/60 hover:bg-ink/[0.04]"
            >
              {tr("Keep")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={tr("Delete this {x}", { x: ticketNoun(kind) })}
            className="hairline inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-ink/60 transition-colors hover:border-expense/40 hover:text-expense"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{tr("Delete")}</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] cursor-pointer rounded-xl px-4 text-sm text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            {tr("Cancel")}
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {tr("Save")}
          </button>
        </div>
      </div>
    </form>
  );
}
