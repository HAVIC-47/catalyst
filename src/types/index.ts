// Catalyst v2 domain types — money (transactions) and mood are separate logs.
import { tr } from "@/lib/i18n";
import type { RecurringFrequency } from "@/lib/recurring";
import type { ChallengeKind } from "@/lib/habits";

export type { RecurringFrequency, ChallengeKind };

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
  walletId: string | null; // null = the default wallet
  recurringId?: string | null; // logged automatically by this recurring rule
}

export type NewTransaction = Omit<Transaction, "id" | "createdAt" | "walletId"> & { walletId?: string | null };

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

/** A mood's name in the app's language (stored and sent in English). */
export function moodName(m: MoodPreset): string {
  return tr(`${m.label}|mood`);
}

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
  categoryId: string | null; // what paying it is logged under (null = matched by name)
  walletId: string | null; // paid from (null = the default wallet)
  lastPaidTxn: string | null; // the expense its last payment logged
}
export type NewBill = Omit<Bill, "id" | "categoryId" | "walletId" | "lastPaidTxn"> &
  Partial<Pick<Bill, "categoryId" | "walletId" | "lastPaidTxn">>;

/** An income or expense that logs itself — a salary on the 1st, rent, a subscription.
 *  Each due date becomes a transaction (see lib/recurring.ts for the dates). */
export interface RecurringRule {
  id: string;
  name: string;
  kind: "expense" | "income";
  amount: number;
  categoryId: string | null; // null = Other
  walletId: string | null; // null = the default wallet
  frequency: RecurringFrequency;
  every: number; // weeks or months between
  day1: number; // weekly: 1 (Mon) … 7 (Sun); otherwise the day of the month
  day2: number | null; // twice a month: the other day
  time: string; // HH:mm, in tz
  startOn: string;
  endOn: string | null;
  nextOn: string; // the next date not logged yet
  paused: boolean;
  tz: string; // the timezone its time is in (where it was saved)
  createdAt: string;
}
export type NewRecurringRule = Omit<RecurringRule, "id" | "createdAt">;

/** A few days' challenge — no-spend days, spending under an amount, skipping a
 *  category, saving an amount, logging every day. Progress comes from the entries. */
export interface Challenge {
  id: string;
  kind: ChallengeKind;
  target: number;
  categoryId: string | null;
  categoryName: string;
  startOn: string;
  days: number;
  createdAt: string;
}
export type NewChallenge = Omit<Challenge, "id" | "createdAt">;

/** Where money sits. A balance is the opening balance plus the entries, transfers and dhar in it. */
export type WalletKind = "cash" | "mobile" | "bank" | "card" | "other";

export interface Wallet {
  id: string;
  name: string;
  kind: WalletKind;
  color: string;
  openingBalance: number;
  sort: number;
  archived: boolean;
}
export type NewWallet = Omit<Wallet, "id">;

/** Money moved between two wallets — never spending or income. */
export interface Transfer {
  id: string;
  fromWallet: string;
  toWallet: string;
  amount: number;
  note: string;
  occurredOn: string; // yyyy-mm-dd
  occurredAt: string;
  createdAt: string;
}
export type NewTransfer = Omit<Transfer, "id" | "createdAt">;

/** Dhar / baki. lent = they owe you; borrowed = you owe them. */
export type DebtDirection = "lent" | "borrowed";

export interface Debt {
  id: string;
  person: string;
  direction: DebtDirection;
  amount: number;
  note: string;
  walletId: string | null; // the money left / came into this wallet
  occurredOn: string;
  dueOn: string | null;
  closed: boolean; // settled or written off
  createdAt: string;
}
export type NewDebt = Omit<Debt, "id" | "createdAt">;

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  walletId: string | null;
  paidOn: string;
  note: string;
  createdAt: string;
}
export type NewDebtPayment = Omit<DebtPayment, "id" | "createdAt">;

export const WALLET_KINDS: { value: WalletKind; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mobile", label: "Mobile money" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

/** Wallets a new account starts with (renamable, more can be added, any can be archived). */
export const DEFAULT_WALLETS: { name: string; kind: WalletKind; color: string }[] = [
  { name: "Cash", kind: "cash", color: "#2E8159" },
  { name: "bKash", kind: "mobile", color: "#E2136E" },
  { name: "Nagad", kind: "mobile", color: "#F26522" },
  { name: "Bank", kind: "bank", color: "#3D80BC" },
];

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
