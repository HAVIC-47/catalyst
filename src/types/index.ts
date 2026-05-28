// Catalyst v2 domain types — money (transactions) and mood are separate logs.

export type Kind = "expense" | "income" | "saving";

/** Special expense category name: amount spent here is subtracted from total savings. */
export const BREAK_SAVING = "Break saving";

export interface Category {
  id: string;
  name: string;
  kind: Kind;
  color: string;
  sort: number;
}

export type NewCategory = Omit<Category, "id">;

export interface Transaction {
  id: string;
  kind: Kind;
  amount: number; // positive; kind carries sign meaning
  categoryId: string | null;
  categoryName: string;
  place: string;
  note: string;
  occurredOn: string; // yyyy-mm-dd (date bucket)
  occurredAt: string; // ISO timestamp (intraday)
  createdAt: string;
}

export type NewTransaction = Omit<Transaction, "id" | "createdAt">;

export interface MoodLog {
  id: string;
  mood: number; // 1..5
  note: string;
  tags: string[]; // context tags, e.g. ["Family time","Travel"]
  loggedOn: string; // yyyy-mm-dd (date bucket)
  loggedAt: string; // ISO timestamp (intraday)
  createdAt: string;
}

/** Preset context tags for the mood entry (what the day was about). */
export const MOOD_TAGS = [
  "Family time",
  "Date",
  "Friends",
  "Travel",
  "Shopping",
  "Work",
  "Study",
  "Exercise",
  "Food",
  "Rest",
  "Health",
  "Alone",
] as const;

export type NewMoodLog = Omit<MoodLog, "id" | "createdAt">;

/** 5 moods, 5 emojis (1 = lowest .. 5 = highest). */
export interface MoodPreset {
  value: number;
  label: string;
  emoji: string;
  color: string;
}

// Mood scale: red (low) -> green (high), passing through orange/yellow/lime.
export const MOOD_PRESETS: MoodPreset[] = [
  { value: 1, label: "Awful", emoji: "😩", color: "#EF4444" }, // red
  { value: 2, label: "Low", emoji: "😕", color: "#F97316" }, // orange
  { value: 3, label: "Okay", emoji: "😐", color: "#EAB308" }, // yellow
  { value: 4, label: "Good", emoji: "🙂", color: "#84CC16" }, // lime
  { value: 5, label: "Great", emoji: "🤩", color: "#22C55E" }, // green
];

export function moodPreset(value: number): MoodPreset {
  return (
    MOOD_PRESETS.find((m) => m.value === value) ??
    MOOD_PRESETS.reduce((b, m) => (Math.abs(m.value - value) < Math.abs(b.value - value) ? m : b))
  );
}

export interface Budget {
  id: string;
  categoryId: string | null;
  categoryName: string;
  amount: number;
  period: string; // 'monthly'
}
export type NewBudget = Omit<Budget, "id">;

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  dueOn: string | null; // yyyy-mm-dd
}
export type NewGoal = Omit<Goal, "id">;

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueOn: string; // yyyy-mm-dd
  recurrence: string; // 'monthly' | 'weekly' | 'yearly' | 'once'
  isPaid: boolean;
}
export type NewBill = Omit<Bill, "id">;

export interface JournalEntry {
  id: string;
  entryOn: string; // yyyy-mm-dd
  mood: number | null; // 1..5
  title: string;
  body: string;
  createdAt: string;
}
export type NewJournalEntry = Omit<JournalEntry, "id" | "createdAt">;

export interface Activity {
  id: string;
  name: string;
  color: string;
  sort: number;
}
export type NewActivity = Omit<Activity, "id">;

export interface ActivityLog {
  id: string;
  activityId: string;
  loggedOn: string; // yyyy-mm-dd
  value: string;
}

/** Default categories seeded for new users (editable in Settings). */
export const DEFAULT_EXPENSE_CATEGORIES: { name: string; color: string }[] = [
  { name: "Food", color: "#F59E0B" },
  { name: "Groceries", color: "#34D399" },
  { name: "Transport", color: "#38BDF8" },
  { name: "Rent", color: "#A855F7" },
  { name: "Utilities", color: "#FBBF24" },
  { name: "Internet", color: "#22D3EE" },
  { name: "Health", color: "#F43F5E" },
  { name: "Education", color: "#818CF8" },
  { name: "Shopping", color: "#EC4899" },
  { name: "Entertainment", color: "#FB7185" },
  { name: "Travel", color: "#2DD4BF" },
  { name: "Subscriptions", color: "#C084FC" },
  { name: "Gifts", color: "#F472B6" },
  { name: "Fitness", color: "#4ADE80" },
  { name: "Personal Care", color: "#E879F9" },
  { name: "Pets", color: "#FCD34D" },
  { name: BREAK_SAVING, color: "#60A5FA" }, // pulls from savings pool when used
  { name: "Other", color: "#64748B" },
];

export const DEFAULT_INCOME_CATEGORIES: { name: string; color: string }[] = [
  { name: "Salary", color: "#34D399" },
  { name: "Freelance", color: "#22D3EE" },
  { name: "Gift", color: "#C084FC" },
  { name: "Other", color: "#64748B" },
];
