"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Check, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { MOOD_PRESETS, moodPreset } from "@/types";
import { cn, toDateKey } from "@/lib/utils";

const ACT_COLORS = ["#22D3EE", "#34D399", "#A855F7", "#F59E0B", "#F43F5E", "#EC4899", "#38BDF8"];

export default function JournalPage() {
  const {
    journal,
    activities,
    activityLogs,
    createJournal,
    removeJournal,
    createActivity,
    removeActivity,
    toggleActivity,
    loading,
  } = useAppData();

  const today = toDateKey(new Date());
  const doneToday = new Set(
    activityLogs.filter((l) => l.loggedOn === today).map((l) => l.activityId),
  );

  // journal form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<number | null>(null);

  // activity add
  const [actName, setActName] = useState("");

  const saveEntry = async () => {
    if (!title.trim() && !body.trim()) return;
    await createJournal({ entryOn: today, mood, title: title.trim(), body: body.trim() });
    setTitle("");
    setBody("");
    setMood(null);
  };

  const addActivity = async () => {
    const n = actName.trim();
    if (!n) return;
    await createActivity({ name: n, color: ACT_COLORS[activities.length % ACT_COLORS.length], sort: activities.length });
    setActName("");
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">Journal · {format(new Date(), "EEEE, MMM d")}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          Daily <span className="serif-italic text-amber/90">log.</span>
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* entry composer + history */}
        <div className="space-y-6">
          <div className="card p-5">
            <div className="label mb-3">New entry · today</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              aria-label="Entry title"
              className="mb-2 w-full rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none focus:border-amber/50"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="How did the day go? What happened?"
              aria-label="Entry body"
              className="w-full resize-none rounded-xl border border-line bg-white/[0.02] p-3 text-sm text-white outline-none focus:border-amber/50"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {MOOD_PRESETS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMood(mood === m.value ? null : m.value)}
                    aria-label={m.label}
                    className={cn(
                      "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-lg transition-all",
                      mood === m.value ? "border-white/30 bg-white/[0.06]" : "border-line opacity-55 hover:opacity-90",
                    )}
                    style={mood === m.value ? { boxShadow: `0 0 18px -8px ${m.color}` } : undefined}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
              <button
                onClick={saveEntry}
                disabled={!title.trim() && !body.trim()}
                className="entry-btn min-h-[42px] cursor-pointer rounded-xl px-5 text-sm font-semibold text-black disabled:opacity-40"
              >
                Save entry
              </button>
            </div>
          </div>

          {!loading && journal.length === 0 && (
            <div className="card px-6 py-12 text-center text-sm text-white/40">
              No journal entries yet. Write your first above.
            </div>
          )}

          <div className="space-y-3">
            {journal.map((j) => {
              const p = j.mood ? moodPreset(j.mood) : null;
              return (
                <div key={j.id} className="card group p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {p && <span className="text-lg">{p.emoji}</span>}
                      <h3 className="font-display text-lg font-semibold text-white">
                        {j.title || "Untitled"}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-white/35">
                        {format(parseISO(j.entryOn), "MMM d, yyyy")}
                      </span>
                      <button
                        onClick={() => removeJournal(j.id)}
                        aria-label="Delete entry"
                        className="cursor-pointer text-white/0 transition-colors group-hover:text-white/30 hover:!text-expense"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  {j.body && <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/65">{j.body}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* custom activities */}
        <div className="card h-fit p-5">
          <div className="label mb-3">Today&apos;s activities</div>
          <p className="mb-4 text-xs text-white/40">
            Track custom daily-life habits. Tap to mark done for today.
          </p>

          <div className="mb-4 space-y-2">
            {activities.map((a) => {
              const on = doneToday.has(a.id);
              return (
                <div key={a.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => toggleActivity(a.id, today)}
                    className={cn(
                      "flex min-h-[40px] flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm transition-colors",
                      on ? "border-white/25 bg-white/[0.06] text-white" : "border-line text-white/55 hover:bg-white/[0.03]",
                    )}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-md border"
                      style={{
                        borderColor: on ? a.color : "rgba(255,255,255,0.15)",
                        backgroundColor: on ? `${a.color}33` : "transparent",
                        color: a.color,
                      }}
                    >
                      {on && <Check className="h-3.5 w-3.5" aria-hidden strokeWidth={3} />}
                    </span>
                    {a.name}
                  </button>
                  <button
                    onClick={() => removeActivity(a.id)}
                    aria-label={`Remove ${a.name}`}
                    className="cursor-pointer text-white/0 transition-colors group-hover:text-white/30 hover:!text-expense"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              );
            })}
            {activities.length === 0 && (
              <p className="text-xs text-white/30">No activities yet. Add one below.</p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-line pt-4">
            <input
              value={actName}
              onChange={(e) => setActName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addActivity()}
              placeholder="e.g. Workout, Read, Sleep 8h"
              aria-label="New activity"
              className="min-h-[40px] flex-1 rounded-lg border border-line bg-white/[0.02] px-3 text-sm text-white outline-none focus:border-amber/50"
            />
            <button
              onClick={addActivity}
              disabled={!actName.trim()}
              aria-label="Add activity"
              className="entry-btn flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-black disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
