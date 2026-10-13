"use client";

// Memo scanner: photograph or upload a memo (receipt), let /api/scan-memo read it,
// review what it found, then add every item as its own expense.
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CircleCheck, ImageUp, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { BREAK_SAVING } from "@/types";
import { TAKA, cn, combineDateTime, formatCurrency, nowTime, toDateKey } from "@/lib/utils";
import { LIMITS } from "@/lib/limits";
import { discountShares, type ScannedMemo } from "@/lib/memo";

type Step = "pick" | "camera" | "reading" | "review" | "done" | "error";

interface Line {
  key: number;
  on: boolean;
  saved: boolean;
  name: string;
  amount: string;
  categoryId: string;
}

const MAX_SIDE = 1600;

// Phone photos are 3–12 MB; the reader only needs ~1600px. Downscale and
// re-encode as JPEG in the browser (drawing an <img> also applies EXIF rotation).
async function toJpeg(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

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
            aria-label="Scan a memo"
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="card relative my-auto w-full max-w-xl overflow-hidden"
          >
            <div className="flex items-start justify-between border-b border-line p-6 pb-5">
              <div>
                <div className="label">Memo</div>
                <h2 className="mt-1 font-display text-3xl font-semibold text-ink">Scan a memo</h2>
              </div>
              <button
                onClick={closeMemo}
                aria-label="Close"
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
  const { categories, addMoney, openEntry } = useAppData();
  const expenseCats = categories.filter((c) => c.kind === "expense" && c.name !== BREAK_SAVING);

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
    setLines([]);
    setError("");
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
      setError("Couldn't open that image — use a JPEG or PNG photo.");
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
          today: toDateKey(new Date()),
        }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.memo) throw new Error(data.error || "The memo reader couldn't process this photo.");
      if (!ctrl.signal.aborted) review(data.memo as ScannedMemo);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No connection — try again.");
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
        });
        // Mark it saved right away so a retry after an error never adds it twice.
        patch(line.key, { saved: true });
        done++;
      }
      setAdded({ count: done, sum });
      setStep("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(done ? `Added ${done} of ${chosen.length}. ${msg} — tap Add again for the rest.` : msg);
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
        {photo && <img src={photo} alt="Your memo" className="max-h-56 rounded-xl border border-line object-contain" />}
        <div className="flex items-center gap-2 text-sm text-ink/75">
          <LoaderCircle className="h-4 w-4 animate-spin text-amber" aria-hidden />
          Reading the memo…
        </div>
        <p className="text-xs text-ink/50">Usually a few seconds.</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        {photo && <img src={photo} alt="Your memo" className="max-h-40 rounded-xl border border-line object-contain opacity-80" />}
        <p className="max-w-sm text-sm text-expense" role="alert">
          {error}
        </p>
        <button
          onClick={reset}
          className="hairline inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-4 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center">
        <CircleCheck className="h-10 w-10 text-income" aria-hidden />
        <div className="font-display text-2xl font-semibold text-ink">
          Added {added.count} expense{added.count === 1 ? "" : "s"}
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
            Scan another
          </button>
          <button
            onClick={onClose}
            className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center rounded-xl px-5 text-sm font-semibold text-paper shadow-entry"
          >
            Done
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
              <span className="label mb-2 block">Shop</span>
              <input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                maxLength={LIMITS.place}
                placeholder="Shop or place"
                className={input}
              />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <label className="block">
                <span className="label mb-2 block">Date</span>
                <input type="date" value={dateKey} onChange={(e) => e.target.value && setDateKey(e.target.value)} className={input} />
              </label>
              <label className="block">
                <span className="label mb-2 block">Time</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
              </label>
            </div>
          </div>

          {oddDate && (
            <p className="mt-2 text-xs text-amber">
              The memo&apos;s date read as {oddDate} — using today instead. Change it above if that&apos;s wrong.
            </p>
          )}

          <div className="label mb-2 mt-6">
            Items · {lines.length}
          </div>
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
                  aria-label={`Add ${l.name}`}
                  className="h-4 w-4 cursor-pointer accent-amber"
                />
                <input
                  value={l.name}
                  onChange={(e) => patch(l.key, { name: e.target.value })}
                  maxLength={LIMITS.title}
                  disabled={l.saved}
                  aria-label="Item"
                  className="min-w-0 bg-transparent text-sm text-ink outline-hidden"
                />
                <div className="flex items-center gap-1 font-mono text-sm">
                  <span className="text-ink/40">{TAKA}</span>
                  <input
                    inputMode="decimal"
                    value={l.amount}
                    onChange={(e) => patch(l.key, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
                    disabled={l.saved}
                    aria-label={`Amount for ${l.name}`}
                    className="w-20 bg-transparent text-right tabular text-ink outline-hidden"
                  />
                </div>
                <select
                  value={l.categoryId}
                  onChange={(e) => patch(l.key, { categoryId: e.target.value })}
                  disabled={l.saved}
                  aria-label={`Category for ${l.name}`}
                  className="col-span-1 col-start-2 min-h-[34px] cursor-pointer rounded-lg border border-line bg-card px-2 text-xs text-ink/80 outline-hidden focus:border-amber/50"
                >
                  {expenseCats.map((c) => (
                    <option key={c.id} value={c.id} className="bg-card">
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="text-right font-mono text-xs text-ink/45">
                  {l.saved ? "added" : shares[i] > 0 ? `−${formatCurrency(shares[i])}` : ""}
                </span>
              </li>
            ))}
          </ul>

          {memo.discount > 0 && (
            <p className="mt-2 text-xs text-ink/55">Discount {formatCurrency(memo.discount)} shared across the items.</p>
          )}
          {memo.currency && memo.currency !== "BDT" && (
            <p className="mt-2 text-xs text-amber">This memo is in {memo.currency} — amounts are saved as taka.</p>
          )}
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 font-mono text-sm">
            <span className="text-ink/55">
              Memo total <span className="text-ink">{memo.total ? formatCurrency(memo.total) : "—"}</span>
            </span>
            <span className="text-ink/55">
              Adding <span className="text-expense">{formatCurrency(sum)}</span>
            </span>
          </div>
          {mismatch && (
            <p className="mt-2 text-xs text-expense">That doesn&apos;t match the memo total — check the amounts.</p>
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
            Retake
          </button>
          <button
            onClick={() => void save()}
            disabled={!chosen.length || saving}
            className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {saving ? "Adding…" : `Add ${chosen.length} expense${chosen.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </>
    );
  }

  // pick
  return (
    <div className="p-6" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <p className="text-sm leading-relaxed text-ink/60">
        Take a photo of a memo or receipt, or upload one. Every item becomes its own expense — you check them before
        anything is saved.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          onClick={takePhoto}
          className="entry-btn flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-paper shadow-entry"
        >
          <Camera className="h-6 w-6" aria-hidden />
          Take photo
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="hairline flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <ImageUp className="h-6 w-6" aria-hidden />
          Upload photo
        </button>
      </div>
      <p className="mt-3 hidden text-center text-xs text-ink/45 lg:block">…or drop an image anywhere here.</p>
      <div className="mt-5 text-center">
        <button
          onClick={() => {
            onClose();
            openEntry();
          }}
          className="cursor-pointer text-xs text-ink/55 underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Add an entry by hand instead
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
            Starting camera…
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-ink/55">Fit the whole memo in the frame — flat, in good light.</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={onCancel}
          className="hairline inline-flex min-h-[44px] cursor-pointer items-center rounded-xl px-4 text-sm text-ink/75 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          Cancel
        </button>
        <button
          onClick={shoot}
          disabled={!ready}
          className="entry-btn inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper shadow-entry disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Camera className="h-4 w-4" aria-hidden />
          Capture
        </button>
      </div>
    </div>
  );
}
