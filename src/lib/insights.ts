// AI summaries (/api/ai-insights): one short read on a topic for a week, month or
// year, plus suggestions. Shared by the API route and the web card; the Android
// app mirrors these shapes in lib/data/insights.dart.

export const INSIGHT_TOPICS = ["journal", "ledger", "goals", "savings", "bills", "mood", "todo", "shopping", "recap"] as const;
export type InsightTopic = (typeof INSIGHT_TOPICS)[number];

export const INSIGHT_PERIODS = ["week", "month", "year"] as const;
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];

/** Tab label for each topic. */
export const INSIGHT_LABELS: Record<InsightTopic, string> = {
  journal: "Journal",
  ledger: "Money",
  goals: "Goals",
  savings: "Savings",
  bills: "Bills",
  mood: "Mood",
  todo: "To-do",
  shopping: "To-buy",
  recap: "Recap",
};

/** Languages the AI can write in — the app's UI language. */
export type InsightLang = "en" | "bn";

export interface Insight {
  headline: string;
  summary: string;
  highlights: string[];
  suggestions: { title: string; detail: string }[];
}

export interface InsightResponse {
  insight: Insight | null;
  generatedAt: string | null; // ISO timestamp of the saved summary
  stale: boolean; // there's newer data than the saved summary
  empty: boolean; // nothing logged for this topic in the period
}
