"use client";

// AI summary card: a short read of one topic (or a few, as tabs) for a week,
// month or year, plus suggestions — written by Gemini on the server from the
// user's own data (/api/ai-insights). The saved summary shows straight away; it's
// only rewritten when the user asks, and the card says when newer entries exist.
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronDown, Lightbulb, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { INSIGHT_LABELS, type InsightPeriod, type InsightResponse, type InsightTopic } from "@/lib/insights";
import { rangeWindow, type Range } from "@/lib/range";
import { cn, toDateKey } from "@/lib/utils";
import { RangeControls } from "@/components/charts/range-controls";

const PERIODS: readonly InsightPeriod[] = ["week", "month", "year"];

const PITCH: Record<InsightTopic, string> = {
  ledger: "A quick read on where your money came from and went — and what to change.",
  savings: "How much you kept and put away, and realistic ways to save more.",
  goals: "Whether your saving pace will reach each goal, and how to get there sooner.",
  bills: "What's due, what's overdue, and how to keep your bills under control.",
  journal: "What your entries were about, how the days felt, and small things that might help.",
  mood: "How your mood moved, what lifted or lowered it, and gentle ways to feel better.",
};

const SUGGESTIONS: Record<InsightTopic, string> = {
  ledger: "Money moves",
  savings: "To save more",
  goals: "To reach your goals",
  bills: "To stay on top of bills",
  journal: "Small things to try",
  mood: "To feel better",
};

type Load = { key: string; status: "loading" | "ready" | "error"; data?: InsightResponse; error?: string };

async function request(body: Record<string, unknown>, signal?: AbortSignal): Promise<InsightResponse> {
  const res = await fetch("/api/ai-insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "AI summaries aren't available right now.");
  return data as InsightResponse;
}

export function AiInsights({ topics, className }: { topics: InsightTopic[]; className?: string }) {
  const app = useAppData();
  const [topic, setTopic] = useState<InsightTopic>(topics[0]);
  const [period, setPeriod] = useState<InsightPeriod>("week");
  const [offset, setOffset] = useState(0);
  const win = rangeWindow(period, offset);
  const key = `${topic}|${period}|${win.startKey}`;

  // Collapsed or open, remembered per card (this browser only).
  const storageKey = `ai-open:${topics.join("+")}`;
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "0") setOpen(false);
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(storageKey, o ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !o;
    });
  };

  // Re-check for newer data whenever the collections behind this topic change
  // (each change makes a new array, so their identities make a cheap signature).
  const ids = useRef(new WeakMap<object, number>());
  const next = useRef(0);
  const idOf = (o: object) => ids.current.get(o) ?? (ids.current.set(o, ++next.current), next.current);
  const sources: Record<InsightTopic, object[]> = {
    ledger: [app.transactions, app.budgets],
    savings: [app.transactions, app.goals],
    goals: [app.goals, app.transactions],
    bills: [app.bills, app.transactions],
    journal: [app.journal, app.activities, app.activityLogs],
    mood: [app.moods, app.transactions, app.journal, app.activityLogs],
  };
  const signature = sources[topic].map(idOf).join(".");

  const [load, setLoad] = useState<Load>({ key: "", status: "loading" });
  const [retry, setRetry] = useState(0);
  const [generating, setGenerating] = useState<string | null>(null); // key being written
  const [genError, setGenError] = useState<{ key: string; message: string } | null>(null);
  const keyRef = useRef(key);
  keyRef.current = key;

  const body = (mode: "cached" | "generate") => ({ topic, period, start: win.startKey, today: toDateKey(new Date()), mode });

  useEffect(() => {
    if (app.loading || !open) return;
    const ctrl = new AbortController();
    const same = load.key === key && load.status === "ready";
    // A new topic or period shows a placeholder; a data change re-checks quietly.
    if (!same) setLoad({ key, status: "loading" });
    const timer = setTimeout(
      () => {
        request(body("cached"), ctrl.signal)
          .then((data) => setLoad({ key, status: "ready", data }))
          .catch((err) => {
            if (ctrl.signal.aborted) return;
            if (!same) setLoad({ key, status: "error", error: err instanceof Error ? err.message : String(err) });
          });
      },
      same ? 800 : 0,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `load` is only read to tell a quiet re-check from a fresh load, so it isn't a dependency.
  }, [key, signature, app.loading, open, retry]);

  const generate = async () => {
    const forKey = key;
    setGenerating(forKey);
    setGenError(null);
    try {
      const data = await request(body("generate"));
      if (keyRef.current === forKey) setLoad({ key: forKey, status: "ready", data });
    } catch (err) {
      setGenError({ key: forKey, message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No connection — try again." });
    } finally {
      setGenerating((g) => (g === forKey ? null : g));
    }
  };

  const isGenerating = generating === key;
  const error = genError?.key === key ? genError.message : "";
  const data = load.key === key ? load.data : undefined;
  const insight = data?.insight ?? null;
  const periodName = offset === 0 ? `this ${period}` : win.label;

  return (
    <section className={cn("card mb-6 overflow-hidden", className)} aria-label="AI summary">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-[48px] w-full cursor-pointer items-center gap-2 px-4 text-left sm:px-5"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-amber" aria-hidden />
        <span className="label shrink-0">AI {topics.length > 1 ? "insights" : `${INSIGHT_LABELS[topic].toLowerCase()} summary`}</span>
        <span className="min-w-0 truncate font-mono text-[11px] text-ink/40">
          · {topics.length > 1 ? `${INSIGHT_LABELS[topic]} · ` : ""}
          {win.label}
        </span>
        <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-ink/40 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            {topics.length > 1 && (
              <div className="flex gap-0.5 rounded-xl border border-line bg-ink/[0.02] p-0.5 sm:gap-1 sm:p-1" role="tablist" aria-label="Topic">
                {topics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={topic === t}
                    onClick={() => setTopic(t)}
                    className={cn(
                      "cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 sm:px-3 sm:py-1.5 sm:text-xs",
                      topic === t ? "seg-on text-amber" : "text-ink/45 hover:text-ink/75",
                    )}
                  >
                    {INSIGHT_LABELS[t]}
                  </button>
                ))}
              </div>
            )}
            <div className={cn(topics.length > 1 ? "w-full sm:w-auto" : "w-full")}>
              <RangeControls
                ranges={PERIODS}
                range={period}
                setRange={(r: Range) => setPeriod(r as InsightPeriod)}
                offset={offset}
                setOffset={setOffset}
              />
            </div>
          </div>

          <div aria-live="polite" aria-busy={isGenerating || load.status === "loading"}>
            {load.key !== key || load.status === "loading" ? (
              <div className="space-y-2.5 py-1" role="status" aria-label="Loading summary">
                <div className="h-6 w-2/3 animate-pulse rounded-md bg-ink/[0.07]" />
                <div className="h-3.5 w-full animate-pulse rounded bg-ink/[0.05]" />
                <div className="h-3.5 w-5/6 animate-pulse rounded bg-ink/[0.05]" />
              </div>
            ) : load.status === "error" ? (
              <div className="py-2 text-sm">
                <p className="text-expense" role="alert">
                  {load.error}
                </p>
                <button
                  type="button"
                  onClick={() => setRetry((r) => r + 1)}
                  className="mt-2 cursor-pointer font-mono text-[11px] uppercase tracking-widest text-amber/80 hover:text-amber"
                >
                  Try again
                </button>
              </div>
            ) : insight ? (
              <div className={cn("transition-opacity", isGenerating && "opacity-50")}>
                <h3 className="font-display text-2xl font-semibold leading-tight text-ink">{insight.headline}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/75">{insight.summary}</p>
                {insight.highlights.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {insight.highlights.map((h) => (
                      <li key={h} className="flex gap-2.5 text-sm leading-snug text-ink/70">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber/80" aria-hidden />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
                {insight.suggestions.length > 0 && (
                  <div className="mt-5">
                    <div className="label mb-2">{SUGGESTIONS[topic]}</div>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {insight.suggestions.map((s) => (
                        <li key={s.title + s.detail} className="rounded-xl border border-line bg-ink/[0.02] p-3">
                          <div className="flex items-start gap-2 text-sm font-medium text-ink">
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
                            {s.title}
                          </div>
                          {s.detail && <p className="mt-1 pl-6 text-xs leading-relaxed text-ink/60">{s.detail}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3 text-[11px] text-ink/45">
                  {data?.stale && !isGenerating && (
                    <span className="rounded-full bg-amber/10 px-2 py-0.5 font-medium text-amber">New entries since</span>
                  )}
                  <span>
                    {data?.generatedAt ? `Written ${formatDistanceToNowStrict(new Date(data.generatedAt), { addSuffix: true })}` : "Written"} by
                    Gemini · can be wrong
                  </span>
                  <button
                    type="button"
                    onClick={() => void generate()}
                    disabled={isGenerating}
                    className="ml-auto inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 font-mono uppercase tracking-widest text-amber/80 transition-colors hover:text-amber disabled:cursor-default disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {isGenerating ? "Writing…" : data?.stale ? "Update" : "Refresh"}
                  </button>
                </div>
              </div>
            ) : data?.empty ? (
              <p className="py-2 text-sm text-ink/50">
                Nothing logged for {periodName} yet. Add some entries and a summary can be written.
              </p>
            ) : (
              <div className="flex flex-col items-start gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-sm leading-relaxed text-ink/60">{PITCH[topic]}</p>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={isGenerating}
                  className="entry-btn inline-flex min-h-[42px] shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper shadow-entry disabled:cursor-default disabled:opacity-60"
                >
                  {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  {isGenerating ? "Writing…" : `Summarize ${periodName}`}
                </button>
              </div>
            )}
            {error && (
              <p className="mt-3 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
