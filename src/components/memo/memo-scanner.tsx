"use client";

// Memo scanner: photograph or upload a memo (receipt) — or a screenshot of notes
// listing expenses and income — let /api/scan-memo read it, review what it found,
// then add it: one expense per memo item, or one entry per note line. Categories a
// note names that don't exist yet are created on save, and the user is told.
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CircleCheck, ClipboardPaste, ImageUp, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { BREAK_SAVING, type Category } from "@/types";
import { currencySymbol, cn, combineDateTime, formatCurrency, nowTime, toDateKey } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";
import { pastedImage, toBase64, toJpeg } from "@/lib/image";
import { discountShares, walletForPayment, type ScannedMemo, type ScannedNotes } from "@/lib/memo";
import { WalletSelect, rememberWallet, useStartWallet } from "@/components/entry/wallet-select";
import { currency } from "@/lib/currency";
import { tr, trn } from "@/lib/i18n";

type Step = "pick" | "camera" | "reading" | "review" | "notes" | "done" | "error";

interface Line {
  key: number;
  on: boolean;
  saved: boolean;
  name: string;
  amount: string;
  categoryId: string;
}

/** A line read from a note: expense or income, with a category by name (new ones are created on save). */
interface Entry {
  key: number;
  on: boolean;
  saved: boolean;
  type: "expense" | "income";
  name: string;
  amount: string;
  category: string;
  date: string;
}

// Colors for categories a note creates (the Settings swatches).
const NEW_COLORS = ["#C06A33", "#2E8159", "#3D80BC", "#7A4E86", "#B59A3C", "#CB453B", "#4C5B82", "#8E5B6E", "#2F6F6B"];

export function MemoScanner() {
  const { memoOpen, closeMemo } = useAppData();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!memoOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMemo();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [memoOpen, closeMemo]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {memoOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-xs" onClick={closeMemo} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={tr("Scan a memo or notes")}
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="card relative my-auto w-full max-w-xl overflow-hidden"
          >
            <div className="flex items-start justify-between border-b border-line p-6 pb-5">
              <div>
                <div className="label">{tr("Memo · notes")}</div>
                <h2 className="mt-1 font-display text-3xl font-semibold text-ink">{tr("Scan a memo")}</h2>
              </div>
              <button
                onClick={closeMemo}
                aria-label={tr("Close")}
                className="cursor-pointer rounded-lg p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <MemoFlow onClose={closeMemo} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function MemoFlow({ onClose }: { onClose: () => void }) {
  const { categories, addMoney, createCategory, openEntry, wallets } = useAppData();
  const expenseCats = categories.filter((c) => c.kind === "expense" && c.name !== BREAK_SAVING);
  const incomeCats = categories.filter((c) => c.kind === "income");

  const [step, setStep] = useState<Step>("pick");
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [memo, setMemo] = useState<ScannedMemo | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [place, setPlace] = useState("");
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [time, setTime] = useState(nowTime);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState({ count: 0, sum: 0 });
  const [oddDate, setOddDate] = useState("");
  // Notes: their lines, and what was saved (for the done screen).
  const [entries, setEntries] = useState<Entry[]>([]);
  const [noted, setNoted] = useState<{ count: number; spent: number; earned: number; created: Category[] } | null>(null);
  // One wallet for everything on the memo or note.
  const startWallet = useStartWallet();
  const [walletId, setWalletId] = useState<string | null>(null);
  const wallet = walletId ?? startWallet;
  // The wallet the image itself pointed to (a bKash or Nagad screenshot, a bank slip, a cash memo).
  const [detected, setDetected] = useState<string | null>(null);

  const request = useRef<AbortController | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Closing the scanner cancels a read in flight; previews are object URLs.
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);

  const reset = () => {
    request.current?.abort();
    setStep("pick");
    setPhoto(null);
    setMemo(null);
    // A wallet picked from the last image doesn't carry over to the next one.
    if (detected && walletId === detected) setWalletId(null);
    setDetected(null);
    setLines([]);
    setEntries([]);
    setNoted(null);
    setError("");
  };

  // ---- notes
  const catsOf = (type: Entry["type"]) => (type === "income" ? incomeCats : expenseCats);
  const findCat = (type: Entry["type"], name: string) =>
    categories.find((c) => c.kind === type && c.name.toLowerCase() === name.trim().toLowerCase());

  const reviewNotes = (n: ScannedNotes) => {
    const fallback = n.date || toDateKey(new Date());
    setEntries(
      n.entries.map((e, key) => ({
        key,
        on: true,
        saved: false,
        type: e.type,
        name: e.name,
        amount: String(e.amount),
        // The user's own spelling when the category exists.
        category: findCat(e.type, e.category)?.name ?? e.category,
        date: e.date || fallback,
      })),
    );
    setNoted(null);
    setTime(nowTime());
    setStep("notes");
  };

  const patchEntry = (key: number, p: Partial<Entry>) => setEntries((es) => es.map((e) => (e.key === key ? { ...e, ...p } : e)));
  const chosenEntries = entries.filter((e) => e.on && !e.saved && parseFloat(e.amount) > 0);
  const entryCategory = (e: Entry) => e.category.trim().slice(0, LIMITS.name) || "Other";
  // Categories the chosen lines name that the user doesn't have yet (created on save).
  const freshCats = [
    ...new Map(
      chosenEntries
        .filter((e) => !findCat(e.type, entryCategory(e)))
        .map((e) => [`${e.type}:${entryCategory(e).toLowerCase()}`, { type: e.type, name: entryCategory(e) }]),
    ).values(),
  ];

  const saveNotes = async () => {
    if (!chosenEntries.length || saving) return;
    setSaving(true);
    setError("");
    const created: Category[] = [];
    let done = 0;
    let spent = 0;
    let earned = 0;
    try {
      // 1. Categories the note named that don't exist yet.
      const byKey = new Map<string, Category>();
      for (const e of chosenEntries) {
        const name = entryCategory(e);
        const k = `${e.type}:${name.toLowerCase()}`;
        if (byKey.has(k)) continue;
        const existing = findCat(e.type, name);
        if (existing) {
          byKey.set(k, existing);
          continue;
        }
        const ofKind = categories.filter((c) => c.kind === e.type).length + created.filter((c) => c.kind === e.type).length;
        const c = await createCategory({
          name,
          kind: e.type,
          color: NEW_COLORS[(categories.length + created.length) % NEW_COLORS.length],
          sort: ofKind,
        });
        created.push(c);
        byKey.set(k, c);
      }
      // 2. One entry per line.
      for (const e of chosenEntries) {
        const cat = byKey.get(`${e.type}:${entryCategory(e).toLowerCase()}`)!;
        const amount = Math.round(parseFloat(e.amount) * 100) / 100;
        const day = e.date || toDateKey(new Date());
        await addMoney({
          kind: e.type,
          amount,
          categoryId: cat.id,
          categoryName: cat.name,
          place: "",
          note: e.name.trim().slice(0, LIMITS.note),
          occurredOn: day,
          occurredAt: combineDateTime(day, time),
          walletId: wallet,
        });
        // Mark it saved right away so a retry after an error never adds it twice.
        patchEntry(e.key, { saved: true });
        done++;
        if (e.type === "income") earned += amount;
        else spent += amount;
      }
      setNoted((prev) => ({
        count: (prev?.count ?? 0) + done,
        spent: (prev?.spent ?? 0) + spent,
        earned: (prev?.earned ?? 0) + earned,
        created: [...(prev?.created ?? []), ...created],
      }));
      rememberWallet(wallet);
      setStep("done");
    } catch (err) {
      // Keep what did get saved, so the done screen still tells the whole story.
      setNoted((prev) => ({
        count: (prev?.count ?? 0) + done,
        spent: (prev?.spent ?? 0) + spent,
        earned: (prev?.earned ?? 0) + earned,
        created: [...(prev?.created ?? []), ...created],
      }));
      const msg = typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err);
      setError(done ? tr("Added {done} of {n}. {msg} — tap Add again for the rest.", { done, n: chosenEntries.length, msg }) : msg);
    } finally {
      setSaving(false);
    }
  };

  const review = (m: ScannedMemo) => {
    const byName = (name: string) => expenseCats.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const fallback = byName("Other") ?? expenseCats[0];
    // VAT, service charge etc. go with the memo's main category (its biggest item).
    const biggest = [...m.items].sort((a, b) => b.amount - a.amount)[0];
    const mainCat = (biggest && byName(biggest.category)) || fallback;
    let key = 0;
    setLines([
      ...m.items.map((i) => ({
        key: key++, on: true, saved: false, name: i.name, amount: String(i.amount),
        categoryId: (byName(i.category) ?? fallback)?.id ?? "",
      })),
      ...m.extras.map((x) => ({
        key: key++, on: true, saved: false, name: x.name, amount: String(x.amount), categoryId: mainCat?.id ?? "",
      })),
    ]);
    setMemo(m);
    setPlace(m.merchant);
    // Trust the printed date only if it's from the last month: a misread digit
    // (৩ vs ৬) would otherwise file the expenses years away from today.
    const today = toDateKey(new Date());
    const monthAgo = toDateKey(new Date(Date.now() - 31 * 86_400_000));
    const recent = !!m.date && m.date <= today && m.date >= monthAgo;
    setDateKey(recent ? m.date : today);
    setOddDate(m.date && !recent ? m.date : "");
    setTime(m.time || nowTime());
    setStep("review");
  };

  const read = async (file: Blob) => {
    setError("");
    setStep("reading");
    let jpeg: Blob;
    try {
      jpeg = await toJpeg(file);
    } catch {
      setError(tr("Couldn't open that image — use a JPEG or PNG photo."));
      setStep("error");
      return;
    }
    setPhoto(URL.createObjectURL(jpeg));
    const ctrl = new AbortController();
    request.current = ctrl;
    try {
      const res = await fetch("/api/scan-memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: await toBase64(jpeg),
          mimeType: "image/jpeg",
          categories: expenseCats.map((c) => c.name),
          incomeCategories: incomeCats.map((c) => c.name),
          notes: true, // also read screenshots of notes (expenses and income)
          today: toDateKey(new Date()),
        }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !(data.memo || data.notes)) throw new Error(data.error || "The memo reader couldn't process this photo.");
      if (ctrl.signal.aborted) return;
      const found = walletForPayment(((data.memo ?? data.notes) as ScannedMemo | ScannedNotes).paidWith, wallets);
      setDetected(found?.id ?? null);
      if (found) setWalletId(found.id);
      if (data.notes) reviewNotes(data.notes as ScannedNotes);
      else review(data.memo as ScannedMemo);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : tr("No connection — try again."));
      setStep("error");
    }
  };

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
  // Phones open their own camera app; computers use the webcam in the page.
  const takePhoto = () => {
    if (window.matchMedia("(pointer: coarse)").matches) cameraInput.current?.click();
    else setStep("camera");
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

  // Amounts after each line's share of the discount (shared out over all lines,
  // so unticking a line doesn't move its share onto the others).
  const amounts = lines.map((l) => {
    const v = parseFloat(l.amount);
    return v > 0 ? v : 0;
  });
  const shares = discountShares(amounts, memo?.discount ?? 0);
  const finals = amounts.map((a, i) => Math.round((a - shares[i]) * 100) / 100);
  const chosen = lines.map((line, i) => ({ line, amount: finals[i] })).filter((x) => x.line.on && !x.line.saved && x.amount > 0);
  const sum = Math.round(chosen.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  const allOn = lines.every((l) => l.on);
  const mismatch = !!memo && memo.total > 0 && allOn && Math.abs(sum - memo.total) > 1;

  const patch = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const save = async () => {
    if (!chosen.length || saving) return;
    setSaving(true);
    setError("");
    const occurredAt = combineDateTime(dateKey, time);
    let done = 0;
    try {
      for (const { line, amount } of chosen) {
        const cat = expenseCats.find((c) => c.id === line.categoryId) ?? expenseCats[0];
        await addMoney({
          kind: "expense",
          amount,
          categoryId: cat?.id ?? null,
          categoryName: cat?.name ?? "Other",
          place: place.trim().slice(0, LIMITS.place),
          note: line.name.trim().slice(0, LIMITS.note),
          occurredOn: dateKey,
          occurredAt,
          walletId: wallet,
        });
        // Mark it saved right away so a retry after an error never adds it twice.
        patch(line.key, { saved: true });
        done++;
      }
      setAdded({ count: done, sum });
      rememberWallet(wallet);
      setStep("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(done ? tr("Added {done} of {n}. {msg} — tap Add again for the rest.", { done, n: chosen.length, msg }) : msg);
    } finally {
      setSaving(false);
    }
  };

  const input =
    "min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50";

  if (step === "camera") {
    return (
      <Webcam
        onShot={(b) => void read(b)}
        onCancel={() => setStep("pick")}
        onFail={(msg) => {
          setError(msg);
          setStep("error");
        }}
      />
    );
  }

  if (step === "reading") {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        {photo && <img src={photo} alt={tr("Your memo")} className="max-h-56 rounded-xl border border-line object-contain" />}
        <div className="flex items-center gap-2 text-sm text-ink/75">
          <LoaderCircle className="h-4 w-4 animate-spin text-amber" aria-hidden />
          {tr("Reading it…")}
        </div>
        <p className="text-xs text-ink/50">{tr("Usually a few seconds.")}</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        {photo && <img src={photo} alt={tr("Your memo")} className="max-h-40 rounded-xl border border-line object-contain opacity-80" />}
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

  if (step === "done" && noted) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center">
        <CircleCheck className="h-10 w-10 text-income" aria-hidden />
        <div className="font-display text-2xl font-semibold text-ink" role="status">
          {trn(noted.count, "Added {n} entry", "Added {n} entries")}
        </div>
        <div className="font-mono text-sm text-ink/60">
          {noted.spent > 0 && <span className="text-expense">{tr("Spent {amount}", { amount: formatCurrency(noted.spent) })}</span>}
          {noted.spent > 0 && noted.earned > 0 && " · "}
          {noted.earned > 0 && <span className="text-income">{tr("Earned {amount}", { amount: formatCurrency(noted.earned) })}</span>}
        </div>
        {noted.created.length > 0 && (
          <p className="mt-3 max-w-sm rounded-xl border border-amber/30 bg-amber/[0.08] px-3 py-2 text-xs leading-relaxed text-ink/75">
            <span className="font-semibold text-amber">
              {noted.created.length === 1 ? tr("New category created: ") : tr("New categories created: ")}
            </span>
            {tr("{list}. Rename or recolor them in Settings.", { list: noted.created.map((c) => `${c.name} (${tr(c.kind)})`).join(", ") })}
          </p>
        )}
        <div className="mt-4 flex gap-2">
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
    );
  }

  if (step === "notes") {
    const spent = chosenEntries.filter((e) => e.type === "expense").reduce((s, e) => s + parseFloat(e.amount), 0);
    const earned = chosenEntries.filter((e) => e.type === "income").reduce((s, e) => s + parseFloat(e.amount), 0);
    const today = toDateKey(new Date());
    return (
      <>
        <div className="max-h-[62vh] overflow-y-auto p-6">
          <p className="text-sm leading-relaxed text-ink/60">
            {trn(
              entries.length,
              "Found {n} entry in your note. Check it — untick it if you don't want it — then add.",
              "Found {n} entries in your note. Check them — untick anything you don't want — then add.",
            )}
          </p>
          {freshCats.length > 0 && (
            <p className="mt-3 rounded-xl border border-amber/30 bg-amber/[0.08] px-3 py-2 text-xs leading-relaxed text-ink/75">
              <span className="font-semibold text-amber">{freshCats.length === 1 ? tr("New category ") : tr("New categories ")}</span>
              {tr("from your note will be created: {list}.", { list: freshCats.map((f) => `${f.name} (${tr(f.type)})`).join(", ") })}
            </p>
          )}
          <WalletSelect value={wallet} onChange={setWalletId} label={tr("Wallet")} className="mt-4" />
          <DetectedWallet id={detected} chosen={wallet} />
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {entries.map((e) => {
              const existing = findCat(e.type, e.category);
              const options = catsOf(e.type);
              return (
                <li
                  key={e.key}
                  className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 p-3", (!e.on || e.saved) && "opacity-50")}
                >
                  <input
                    type="checkbox"
                    checked={e.on}
                    disabled={e.saved}
                    onChange={(ev) => patchEntry(e.key, { on: ev.target.checked })}
                    aria-label={tr("Add {name}", { name: e.name })}
                    className="h-4 w-4 cursor-pointer accent-amber"
                  />
                  <input
                    value={e.name}
                    onChange={(ev) => patchEntry(e.key, { name: ev.target.value })}
                    maxLength={LIMITS.title}
                    disabled={e.saved}
                    aria-label={tr("Description")}
                    className="min-w-0 bg-transparent text-sm text-ink outline-hidden"
                  />
                  <div className="flex items-center gap-1 font-mono text-sm">
                    <span className={e.type === "income" ? "text-income" : "text-expense"}>{e.type === "income" ? "+" : "−"}</span>
                    <span className="text-ink/40">{currencySymbol()}</span>
                    <input
                      inputMode="decimal"
                      value={e.amount}
                      onChange={(ev) => patchEntry(e.key, { amount: ev.target.value.replace(/[^0-9.]/g, "") })}
                      disabled={e.saved}
                      aria-label={tr("Amount for {name}", { name: e.name })}
                      className="w-20 bg-transparent text-right tabular text-ink outline-hidden"
                    />
                  </div>
                  <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-2">
                    <div role="radiogroup" aria-label={tr("Type of {name}", { name: e.name })} className="flex rounded-lg border border-line p-0.5">
                      {(["expense", "income"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={e.type === t}
                          disabled={e.saved}
                          onClick={() => patchEntry(e.key, { type: t })}
                          className={cn(
                            "min-h-[28px] cursor-pointer rounded-md px-2 text-[11px] font-medium capitalize transition-colors",
                            e.type === t
                              ? t === "income"
                                ? "bg-income/15 text-income"
                                : "bg-expense/15 text-expense"
                              : "text-ink/50 hover:text-ink/80",
                          )}
                        >
                          {t === "income" ? tr("Income") : tr("Expense")}
                        </button>
                      ))}
                    </div>
                    <select
                      value={existing?.name ?? e.category}
                      onChange={(ev) => patchEntry(e.key, { category: ev.target.value })}
                      disabled={e.saved}
                      aria-label={tr("Category for {name}", { name: e.name })}
                      className="min-h-[32px] max-w-[11rem] cursor-pointer rounded-lg border border-line bg-card px-2 text-xs text-ink/80 outline-hidden focus:border-amber/50"
                    >
                      {!existing && e.category.trim() && (
                        <option value={e.category} className="bg-card">{tr("New: {category}", { category: e.category })}</option>
                      )}
                      {options.map((c) => (
                        <option key={c.id} value={c.name} className="bg-card">
                          {tr(c.name)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={e.date}
                      max={today}
                      onChange={(ev) => patchEntry(e.key, { date: ev.target.value })}
                      disabled={e.saved}
                      aria-label={tr("Date of {name}", { name: e.name })}
                      className="min-h-[32px] rounded-lg border border-line bg-card px-2 text-xs text-ink/80 outline-hidden focus:border-amber/50"
                    />
                    {e.saved && <span className="label text-[10px]">{tr("added")}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 font-mono text-sm">
            <span className="text-ink/55">
              {tr("Spending")}{" "}<span className="text-expense">{formatCurrency(Math.round(spent * 100) / 100)}</span>
            </span>
            <span className="text-ink/55">
              {tr("Income")}{" "}<span className="text-income">{formatCurrency(Math.round(earned * 100) / 100)}</span>
            </span>
          </div>
          {error && (
            <p className="mt-3 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line p-4">
          <button
            onClick={reset}
            disabled={saving}
            className="hairline inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm text-ink/75 transition-colors hover:bg-ink/[0.04] hover:text-ink disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {tr("Retake")}
          </button>
          <button
            onClick={() => void saveNotes()}
            disabled={!chosenEntries.length || saving}
            className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {saving ? tr("Adding…") : trn(chosenEntries.length, "Add {n} entry", "Add {n} entries")}
          </button>
        </div>
      </>
    );
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center">
        <CircleCheck className="h-10 w-10 text-income" aria-hidden />
        <div className="font-display text-2xl font-semibold text-ink">
          {tr("Added")}{" "}{added.count}{" "}{tr("expense")}{added.count === 1 ? "" : "s"}
        </div>
        <div className="font-mono text-sm text-ink/60">
          {formatCurrency(added.sum)}
          {place.trim() ? ` · ${place.trim()}` : ""}
        </div>
        <div className="mt-4 flex gap-2">
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
    );
  }

  if (step === "review" && memo) {
    return (
      <>
        <div className="max-h-[62vh] overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="block">
              <span className="label mb-2 block">{tr("Shop")}</span>
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                maxLength={LIMITS.place}
                placeholder={tr("Shop or place")}
                className={input}
              />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <label className="block">
                <span className="label mb-2 block">{tr("Date")}</span>
                <input type="date" value={dateKey} onChange={(e) => e.target.value && setDateKey(e.target.value)} className={input} />
              </label>
              <label className="block">
                <span className="label mb-2 block">{tr("Time")}</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
              </label>
            </div>
          </div>

          {oddDate && (
            <p className="mt-2 text-xs text-amber">{tr("The memo's date read as {oddDate} — using today instead. Change it above if that's wrong.", { oddDate })}</p>
          )}

          <WalletSelect value={wallet} onChange={setWalletId} label={tr("Paid from")} className="mt-4" />
          <DetectedWallet id={detected} chosen={wallet} />

          <div className="label mb-2 mt-6">{tr("Items · {n}", { n: lines.length })}</div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {lines.map((l, i) => (
              <li
                key={l.key}
                className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 p-3", (!l.on || l.saved) && "opacity-50")}
              >
                <input
                  type="checkbox"
                  checked={l.on}
                  disabled={l.saved}
                  onChange={(e) => patch(l.key, { on: e.target.checked })}
                  aria-label={tr("Add {name}", { name: l.name })}
                  className="h-4 w-4 cursor-pointer accent-amber"
                />
                <input
                  value={l.name}
                  onChange={(e) => patch(l.key, { name: e.target.value })}
                  maxLength={LIMITS.title}
                  disabled={l.saved}
                  aria-label={tr("Item")}
                  className="min-w-0 bg-transparent text-sm text-ink outline-hidden"
                />
                <div className="flex items-center gap-1 font-mono text-sm">
                  <span className="text-ink/40">{currencySymbol()}</span>
                  <input
                    inputMode="decimal"
                    value={l.amount}
                    onChange={(e) => patch(l.key, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                    disabled={l.saved}
                    aria-label={tr("Amount for {name}", { name: l.name })}
                    className="w-20 bg-transparent text-right tabular text-ink outline-hidden"
                  />
                </div>
                <select
                  value={l.categoryId}
                  onChange={(e) => patch(l.key, { categoryId: e.target.value })}
                  disabled={l.saved}
                  aria-label={tr("Category for {name}", { name: l.name })}
                  className="col-span-1 col-start-2 min-h-[34px] cursor-pointer rounded-lg border border-line bg-card px-2 text-xs text-ink/80 outline-hidden focus:border-amber/50"
                >
                  {expenseCats.map((c) => (
                    <option key={c.id} value={c.id} className="bg-card">
                      {tr(c.name)}
                    </option>
                  ))}
                </select>
                <span className="text-right font-mono text-xs text-ink/45">
                  {l.saved ? tr("added") : shares[i] > 0 ? `−${formatCurrency(shares[i])}` : ""}
                </span>
              </li>
            ))}
          </ul>

          {memo.discount > 0 && (
            <p className="mt-2 text-xs text-ink/55">{tr("Discount {amount} shared across the items.", { amount: formatCurrency(memo.discount) })}</p>
          )}
          {memo.currency && memo.currency !== currency().code && (
            <p className="mt-2 text-xs text-amber">{tr("This memo is in {currency} — amounts are saved as {x}, as written.", { currency: memo.currency, x: currency().name.toLowerCase() })}</p>
          )}
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 font-mono text-sm">
            <span className="text-ink/55">
              {tr("Memo total")}{" "}<span className="text-ink">{memo.total ? formatCurrency(memo.total) : "—"}</span>
            </span>
            <span className="text-ink/55">
              {tr("Adding")}{" "}<span className="text-expense">{formatCurrency(sum)}</span>
            </span>
          </div>
          {mismatch && (
            <p className="mt-2 text-xs text-expense">{tr("That doesn't match the memo total — check the amounts.")}</p>
          )}
          {error && (
            <p className="mt-3 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line p-4">
          <button
            onClick={reset}
            disabled={saving}
            className="hairline inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm text-ink/75 transition-colors hover:bg-ink/[0.04] hover:text-ink disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {tr("Retake")}
          </button>
          <button
            onClick={() => void save()}
            disabled={!chosen.length || saving}
            className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {saving ? tr("Adding…") : trn(chosen.length, "Add {n} expense", "Add {n} expenses")}
          </button>
        </div>
      </>
    );
  }

  // pick
  return (
    <div className="p-6" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <p className="text-sm leading-relaxed text-ink/60">
        {tr("Take a photo of a memo or receipt — or upload a screenshot of your notes (Notepad, any notes app, a chat) with expenses and income. You check everything before it's saved, and categories your note names that you don't have yet are created for you.")}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          onClick={takePhoto}
          className="entry-btn flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-paper shadow-entry"
        >
          <Camera className="h-6 w-6" aria-hidden />
          {tr("Take photo")}
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="hairline flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <ImageUp className="h-6 w-6" aria-hidden />
          {tr("Upload photo or screenshot")}
        </button>
      </div>
      <p className="mt-3 hidden items-center justify-center gap-1.5 text-center text-xs text-ink/45 lg:flex">
        <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
        {tr("…or paste a screenshot (Ctrl+V), or drop an image anywhere here.")}
      </p>
      <div className="mt-5 text-center">
        <button
          onClick={() => {
            onClose();
            openEntry();
          }}
          className="cursor-pointer text-xs text-ink/55 underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          {tr("Add an entry by hand instead")}
        </button>
      </div>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}

/* Webcam capture for computers (phones use their own camera app instead). */
function Webcam({
  onShot,
  onCancel,
  onFail,
}: {
  onShot: (b: Blob) => void;
  onCancel: () => void;
  onFail: (msg: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      failRef.current("No camera available here — upload a photo instead.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => alive && failRef.current("Couldn't open the camera — allow camera access, or upload a photo instead."));
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    canvas.toBlob((b) => b && onShot(b), "image/jpeg", 0.92);
  };

  return (
    <div className="p-6">
      <div className="relative overflow-hidden rounded-xl border border-line bg-ink/90">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setReady(true)}
          className="aspect-[4/3] w-full object-cover"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-paper/80">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            {tr("Starting camera…")}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-ink/55">{tr("Fit the whole memo in the frame — flat, in good light.")}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={onCancel}
          className="hairline inline-flex min-h-[44px] cursor-pointer items-center rounded-xl px-4 text-sm text-ink/75 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          {tr("Cancel")}
        </button>
        <button
          onClick={shoot}
          disabled={!ready}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Camera className="h-4 w-4" aria-hidden />
          {tr("Capture")}
        </button>
      </div>
    </div>
  );
}

/** Says which wallet the image pointed to, while it's still the one picked. */
function DetectedWallet({ id, chosen }: { id: string | null; chosen: string | null }) {
  const { wallets } = useAppData();
  const w = id && id === chosen ? wallets.find((x) => x.id === id) : null;
  if (!w) return null;
  return <p className="mt-1.5 text-[11px] text-ink/50">{tr("Paid with {name} — picked from the image.", { name: tr(w.name) })}</p>;
}
