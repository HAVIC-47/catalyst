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

// Mood scale: earthy brick (low) -> forest green (high). Muted, printed-ink tones
// that sit naturally on bone paper (no neon).
export const MOOD_PRESETS: MoodPreset[] = [
  { value: 1, label: "Awful", emoji: "😩", color: "#A8322A" }, // brick red
  { value: 2, label: "Low", emoji: "😕", color: "#C06A33" }, // burnt orange
  { value: 3, label: "Okay", emoji: "😐", color: "#B59A3C" }, // ochre
  { value: 4, label: "Good", emoji: "🙂", color: "#6E8C46" }, // olive
  { value: 5, label: "Great", emoji: "🤩", color: "#2F6B4E" }, // forest
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
  { name: "Food", color: "#C06A33" },
  { name: "Groceries", color: "#2F6B4E" },
  { name: "Transport", color: "#34618A" },
  { name: "Rent", color: "#7A4E86" },
  { name: "Utilities", color: "#B59A3C" },
  { name: "Internet", color: "#34618A" },
  { name: "Health", color: "#B23A2C" },
  { name: "Education", color: "#4C5B82" },
  { name: "Shopping", color: "#8E5B6E" },
  { name: "Entertainment", color: "#A6694A" },
  { name: "Travel", color: "#2F6F6B" },
  { name: "Subscriptions", color: "#7A4E86" },
  { name: "Gifts", color: "#8E5B6E" },
  { name: "Fitness", color: "#6E8C46" },
  { name: "Personal Care", color: "#7A4E86" },
  { name: "Pets", color: "#B59A3C" },
  { name: BREAK_SAVING, color: "#34618A" }, // pulls from savings pool when used
  { name: "Other", color: "#7A746A" },
];

export const DEFAULT_INCOME_CATEGORIES: { name: string; color: string }[] = [
  { name: "Salary", color: "#2F6B4E" },
  { name: "Freelance", color: "#34618A" },
  { name: "Gift", color: "#7A4E86" },
  { name: "Other", color: "#7A746A" },
];
