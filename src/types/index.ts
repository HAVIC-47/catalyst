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

/** 5 moods (1 = lowest .. 5 = highest). Rendered with <MoodIcon> faces. */
export interface MoodPreset {
  value: number;
  label: string;
  color: string;
}

// Mood scale: earthy brick (low) -> forest green (high). Muted, printed-ink tones
// that read on both white paper and black.
export const MOOD_PRESETS: MoodPreset[] = [
  { value: 1, label: "Awful", color: "#A8322A" }, // brick red
  { value: 2, label: "Low", color: "#C06A33" }, // burnt orange
  { value: 3, label: "Okay", color: "#B59A3C" }, // ochre
  { value: 4, label: "Good", color: "#6E8C46" }, // olive
  { value: 5, label: "Great", color: "#2E8159" }, // forest
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

/** Jira-style boards: "todo" (tasks) and "shopping" (things to buy) share one UI. */
export type BoardKind = "todo" | "shopping";

export interface Board {
  id: string;
  name: string;
  kind: BoardKind;
  sort: number;
}

/** A board's status column ("To do", "In progress", "Done"…), ordered by sort. */
export interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  sort: number;
}

export type TicketPriority = "low" | "medium" | "high";

export interface Ticket {
  id: string;
  boardId: string;
  columnId: string;
  number: number; // per-board, shown as #12
  title: string;
  description: string;
  priority: TicketPriority;
  dueOn: string | null; // yyyy-mm-dd
  amount: number | null; // price, for to-buy items
  sort: number; // order inside the column (float: a move rewrites one row)
}
export type NewTicket = Omit<Ticket, "id">;

/** Columns a new board starts with (renamable, and more can be added). */
export const DEFAULT_BOARD_COLUMNS: Record<BoardKind, string[]> = {
  todo: ["To do", "In progress", "Done"],
  shopping: ["To buy", "In cart", "Bought"],
};

export const TICKET_PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

/** Default categories seeded for new users (editable in Settings). */
export const DEFAULT_EXPENSE_CATEGORIES: { name: string; color: string }[] = [
  { name: "Food", color: "#C06A33" },
  { name: "Groceries", color: "#2E8159" },
  { name: "Transport", color: "#3D80BC" },
  { name: "Rent", color: "#7A4E86" },
  { name: "Utilities", color: "#B59A3C" },
  { name: "Internet", color: "#3D80BC" },
  { name: "Health", color: "#CB453B" },
  { name: "Education", color: "#4C5B82" },
  { name: "Shopping", color: "#8E5B6E" },
  { name: "Entertainment", color: "#A6694A" },
  { name: "Travel", color: "#2F6F6B" },
  { name: "Subscriptions", color: "#7A4E86" },
  { name: "Gifts", color: "#8E5B6E" },
  { name: "Fitness", color: "#6E8C46" },
  { name: "Personal Care", color: "#7A4E86" },
  { name: "Pets", color: "#B59A3C" },
  { name: BREAK_SAVING, color: "#3D80BC" }, // pulls from savings pool when used
  { name: "Other", color: "#7A746A" },
];

export const DEFAULT_INCOME_CATEGORIES: { name: string; color: string }[] = [
  { name: "Salary", color: "#2E8159" },
  { name: "Freelance", color: "#3D80BC" },
  { name: "Gift", color: "#7A4E86" },
  { name: "Other", color: "#7A746A" },
];
