"use client";

// List scanner: a screenshot or photo of a list (any notes app, Notepad, a chat, a
// handwritten list) -> /api/scan-list reads it -> every item goes straight onto the
// selected to-do or to-buy board, with Undo. Ticked or crossed-out items land in
// the board's last column (Done / Bought).
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CircleCheck, ClipboardPaste, ImageUp, LoaderCircle, RotateCcw, Undo2, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import type { BoardKind, Ticket } from "@/types";
import { cn, formatCurrency, toDateKey } from "@/lib/utils";
import { pastedImage, toBase64, toJpeg } from "@/lib/image";
import type { ListItem } from "@/lib/memo";
import { boardCopy } from "@/components/boards/board-page";
import { boardError, ticketNoun } from "@/components/boards/board-view";
import { PriorityIcon } from "@/components/boards/ticket-card";
import { tr } from "@/lib/i18n";

export function ListScanner() {
  const { listScan, closeListScan } = useAppData();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!listScan) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeListScan();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listScan, closeListScan]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {listScan && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs" onClick={closeListScan} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={tr("Add {x} from a screenshot", { x: ticketNoun(listScan, 2) })}
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="card relative my-auto w-full max-w-lg overflow-hidden"
          >
            <div className="flex items-start justify-between border-b border-line p-6 pb-5">
              <div>
                <div className="label">{boardCopy(listScan).kicker}</div>
                <h2 className="mt-1 font-display text-3xl font-semibold text-ink">{tr("Scan a list")}</h2>
              </div>
              <button
                onClick={closeListScan}
                aria-label={tr("Close")}
                className="cursor-pointer rounded-lg p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <ScanFlow key={listScan} kind={listScan} onClose={closeListScan} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

type Step = "pick" | "reading" | "done" | "error";

function ScanFlow({ kind, onClose }: { kind: BoardKind; onClose: () => void }) {
  const { boards, boardColumns, selectedBoards, selectBoard, createBoard, addTickets, removeTickets } = useAppData();
  const copy = boardCopy(kind);
  const target = boards.find((b) => b.kind === kind && b.id === selectedBoards[kind]) ?? boards.find((b) => b.kind === kind) ?? null;

  const [step, setStep] = useState<Step>("pick");
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<{ board: string; doneColumn: string; tickets: Ticket[] } | null>(null);
  const [undone, setUndone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touch, setTouch] = useState(false);
  const request = useRef<AbortController | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  // Closing cancels a read in flight; previews are object URLs.
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);

  const reset = () => {
    request.current?.abort();
    setStep("pick");
    setPhoto(null);
    setAdded(null);
    setUndone(false);
    setError("");
  };

  // Everything goes in at once, in the list's order: open items at the bottom of
  // the first column, ticked ones in the last. No board yet? Start one.
  const addAll = async (items: ListItem[]) => {
    let board = target;
    let columns = board ? boardColumns.filter((c) => c.boardId === board!.id).sort((a, b) => a.sort - b.sort) : [];
    if (!board) {
      const made = await createBoard(copy.suggested, kind);
      board = made.board;
      columns = made.columns;
      selectBoard(kind, board.id);
    }
    if (!columns.length) throw new Error(tr("Add a column to \"{name}\" first.", { name: board.name }));
    const first = columns[0].id;
    const last = columns.length > 1 ? columns[columns.length - 1].id : first;
    const tickets = await addTickets(
      board.id,
      items.map((i) => ({
        columnId: i.done ? last : first,
        fields: {
          title: i.title,
          description: i.notes,
          priority: i.priority,
          dueOn: i.due || null,
          amount: kind === "shopping" && i.price > 0 ? i.price : null,
        },
      })),
    );
    setAdded({ board: board.name, doneColumn: columns.length > 1 ? last : "", tickets });
    setStep("done");
  };

  const read = async (file: Blob) => {
    setError("");
    setStep("reading");
    let jpeg: Blob;
    try {
      jpeg = await toJpeg(file);
    } catch {
      setError(tr("Couldn't open that image — use a JPEG or PNG screenshot."));
      setStep("error");
      return;
    }
    setPhoto(URL.createObjectURL(jpeg));
    const ctrl = new AbortController();
    request.current = ctrl;
    try {
      const res = await fetch("/api/scan-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: await toBase64(jpeg), mimeType: "image/jpeg", kind, today: toDateKey(new Date()) }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.list) throw new Error(data.error || tr("Couldn't read this screenshot."));
      if (ctrl.signal.aborted) return;
      await addAll(data.list.items as ListItem[]);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof TypeError ? tr("No connection — try again.") : boardError(err));
      setStep("error");
    }
  };

  // Paste a screenshot (Ctrl+V) while choosing.
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    if (step !== "pick") return;
    const onPaste = (e: ClipboardEvent) => {
      const file = pastedImage(e);
      if (!file) return;
      e.preventDefault();
      void readRef.current(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [step]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void read(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    if (file) void read(file);
  };

  const undo = async () => {
    if (!added) return;
    setBusy(true);
    setError("");
    try {
      await removeTickets(added.tickets.map((t) => t.id));
      setUndone(true);
    } catch (err) {
      setError(boardError(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "reading") {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        {photo && <img src={photo} alt={tr("Your list")} className="max-h-56 rounded-xl border border-line object-contain" />}
        <div className="flex items-center gap-2 text-sm text-ink/75">
          <LoaderCircle className="h-4 w-4 animate-spin text-amber" aria-hidden />
          {tr("Reading the list…")}
        </div>
        <p className="text-xs text-ink/50">{tr("Usually a few seconds.")}</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        {photo && <img src={photo} alt={tr("Your list")} className="max-h-40 rounded-xl border border-line object-contain opacity-80" />}
        <p className="max-w-sm text-sm text-expense" role="alert">
          {error}
        </p>
        <button
          onClick={reset}
          className="hairline inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {tr("Try again")}
        </button>
      </div>
    );
  }

  if (step === "done" && added) {
    const n = added.tickets.length;
    const total = added.tickets.reduce((s, t) => s + (t.amount ?? 0), 0);
    return (
      <div className="p-6">
        <div className="flex flex-col items-center gap-1.5 text-center">
          {undone ? (
            <Undo2 className="h-10 w-10 text-ink/50" aria-hidden />
          ) : (
            <CircleCheck className="h-10 w-10 text-income" aria-hidden />
          )}
          <div className="font-display text-2xl font-semibold text-ink" role="status">
            {undone ? tr("Taken back off the board") : tr("Added {n} {x}", { n, x: ticketNoun(kind, n) })}
          </div>
          <div className="text-sm text-ink/60">
            {undone ? tr("Nothing was kept on {board}.", { board: added.board }) : tr("to {board}", { board: added.board })}
            {!undone && total > 0 && <span className="font-mono"> · {formatCurrency(total)}</span>}
          </div>
        </div>
        {!undone && (
          <ul className="mt-5 max-h-[40vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {added.tickets.map((t) => {
              const done = t.columnId === added.doneColumn;
              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <PriorityIcon priority={t.priority} />
                  <span className={cn("min-w-0 flex-1 truncate text-ink/85", done && "text-ink/45 line-through")}>{t.title}</span>
                  {t.amount !== null && <span className="font-mono text-xs tabular text-ink/60">{formatCurrency(t.amount)}</span>}
                  {done && <span className="label text-[10px]">{kind === "shopping" ? tr("bought") : tr("done")}</span>}
                </li>
              );
            })}
          </ul>
        )}
        {error && (
          <p className="mt-3 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {!undone ? (
            <button
              onClick={() => void undo()}
              disabled={busy}
              className="hairline inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm text-ink/75 transition-colors hover:bg-ink/[0.04] hover:text-ink disabled:opacity-40"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />}
              {tr("Undo")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="hairline inline-flex min-h-[44px] cursor-pointer items-center rounded-xl px-4 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
            >
              {tr("Scan another")}
            </button>
            <button
              onClick={onClose}
              className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center rounded-xl px-5 text-sm font-semibold text-paper shadow-entry"
            >
              {tr("Done")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // pick
  return (
    <div className="p-6" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <p className="text-sm leading-relaxed text-ink/60">
        {kind === "shopping"
          ? tr("Upload a screenshot of your shopping list — from any notes app, Notepad, a chat, or a photo of a handwritten list. Every item goes straight onto ")
          : tr("Upload a screenshot of your to-do list — from any notes app, Notepad, a chat, or a photo of a handwritten list. Every item goes straight onto ")}
        <span className="font-medium text-ink">{target?.name ?? copy.suggested}</span>
        {target ? "" : tr(" (a new {board})", { board: copy.board })}
        {kind === "shopping" ? tr("; ticked items go in as bought.") : tr("; ticked items go in as done.")}
      </p>
      <div className={cn("mt-5 grid gap-3", touch && "sm:grid-cols-2")}>
        <button
          onClick={() => fileInput.current?.click()}
          className="entry-btn flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-paper shadow-entry"
        >
          <ImageUp className="h-6 w-6" aria-hidden />
          {tr("Upload screenshot")}
        </button>
        {touch && (
          <button
            onClick={() => cameraInput.current?.click()}
            className="hairline flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            <Camera className="h-6 w-6" aria-hidden />
            {tr("Take photo")}
          </button>
        )}
      </div>
      {!touch && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink/45">
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
          {tr("…or paste a screenshot (Ctrl+V), or drop an image here.")}
        </p>
      )}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}
