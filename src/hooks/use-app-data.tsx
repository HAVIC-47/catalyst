"use client";

// Central client store for the authenticated app.
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Activity,
  ActivityLog,
  Bill,
  Board,
  BoardColumn,
  BoardKind,
  Budget,
  Category,
  Challenge,
  Debt,
  DebtPayment,
  Goal,
  JournalEntry,
  MoodLog,
  NewActivity,
  NewBill,
  NewBudget,
  NewCategory,
  NewChallenge,
  NewDebt,
  NewDebtPayment,
  NewGoal,
  NewJournalEntry,
  NewMoodLog,
  NewRecurringRule,
  NewTicket,
  NewTransaction,
  NewTransfer,
  NewWallet,
  RecurringRule,
  Ticket,
  Transaction,
  Transfer,
  Wallet,
} from "@/types";
import { BREAK_SAVING, DEFAULT_BOARD_COLUMNS } from "@/types";
import {
  addCategory,
  deleteCategory,
  listCategories,
  seedDefaultCategories,
  updateCategory,
} from "@/lib/db/categories";
import { addTransaction, deleteTransaction, listTransactions, updateTransaction } from "@/lib/db/transactions";
import { addMood, listMoods } from "@/lib/db/moods";
import { addBudget, deleteBudget, listBudgets, updateBudget } from "@/lib/db/budgets";
import { addGoal, deleteGoal, listGoals, updateGoal } from "@/lib/db/goals";
import { addBill, deleteBill, listBills, updateBill } from "@/lib/db/bills";
import { addJournal, deleteJournal, listJournal } from "@/lib/db/journal";
import {
  addActivity,
  addActivityLog,
  deleteActivity,
  deleteActivityLog,
  listActivities,
  listActivityLogs,
} from "@/lib/db/activities";
import {
  addBoard,
  addBoardColumns,
  addTicket,
  addTickets as insertTickets,
  deleteBoard,
  deleteBoardColumn,
  deleteTicket,
  deleteTickets as deleteTicketRows,
  listBoardColumns,
  listBoards,
  listTickets,
  updateBoard,
  updateBoardColumn,
  updateTicket,
} from "@/lib/db/boards";
import {
  addTransfer,
  addWallet,
  deleteTransfer,
  deleteWallet,
  listTransfers,
  listWallets,
  seedDefaultWallets,
  updateWallet,
} from "@/lib/db/wallets";
import {
  addDebt,
  addDebtPayment,
  deleteDebt,
  deleteDebtPayment,
  listDebtPayments,
  listDebts,
  updateDebt,
} from "@/lib/db/debts";
import { loadPrefs, savePrefs } from "@/lib/db/prefs";
import { addRecurring, advanceRecurring, deleteRecurring, listRecurring, logRecurring, updateRecurring } from "@/lib/db/recurring";
import { addChallenge, deleteChallenge, listChallenges } from "@/lib/db/challenges";
import { dueDates, firstNextOn, nextAfterLogged, sameSchedule, zonedIso, zonedNow, type Schedule } from "@/lib/recurring";
import { challengeProgress, challengeTitle, loggedDays, moodSpendAlert, streakMilestone, streakOf } from "@/lib/habits";
import { parseHiddenSections, type DashboardSectionId } from "@/lib/dashboard-sections";
import { SORT_STEP, sortBetween } from "@/lib/boards";
import { setCurrency } from "@/lib/currency";
import { DEFAULT_REMINDERS, parseReminders, type ReminderPrefs } from "@/lib/reminders";
import { billCategory, budgetUse, debtRemaining, defaultWallet, nextDue, ruleCategory } from "@/lib/money";
import { formatCurrency, nowTime, toDateKey, combineDateTime } from "@/lib/utils";
import { asLang, rememberLang, setLang, storedLang, tr, type Lang } from "@/lib/i18n";

export type EntryTab = "money" | "mood" | "saving";

/** Ticket fields the editor can change (column moves go through placeTicket). */
export type TicketFields = Pick<Ticket, "title" | "description" | "priority" | "dueOn" | "amount">;

// Key for the hidden dashboard sections, both in localStorage and user metadata.
const DASHBOARD_HIDDEN = "dashboardHidden";

export type { ReminderPrefs } from "@/lib/reminders";

/** A short notice at the bottom of the screen (budget alerts, "Paid — Undo"). */
export interface Toast {
  id: number;
  message: string;
  tone?: "info" | "warn";
  action?: { label: string; run: () => void | Promise<void> };
}

/** A new recurring entry: where it's got to (nextOn), its timezone and pause come later. */
export type RecurringInput = Omit<NewRecurringRule, "nextOn" | "tz" | "paused">;

/** This browser's timezone (recurring times are kept in it). */
const deviceTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
  } catch {
    return "Asia/Dhaka";
  }
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

/** What paying a bill changed, so Undo can put it back. */
export interface BillPayment {
  billId: string;
  txnId: string;
  before: { dueOn: string; isPaid: boolean; lastPaidTxn: string | null };
}

interface AppDataValue {
  loading: boolean;
  categories: Category[];
  transactions: Transaction[];
  moods: MoodLog[];
  budgets: Budget[];
  goals: Goal[];
  bills: Bill[];
  journal: JournalEntry[];
  activities: Activity[];
  activityLogs: ActivityLog[];
  boards: Board[];
  boardColumns: BoardColumn[];
  tickets: Ticket[];
  wallets: Wallet[];
  transfers: Transfer[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  /** False until the database has the wallets update (db/supabase.sql). */
  walletsReady: boolean;
  /** Incomes and expenses that log themselves, and challenges. */
  recurring: RecurringRule[];
  challenges: Challenge[];
  /** False until the database has the 1.5 update (db/supabase.sql: recurring, challenges). */
  recurringReady: boolean;

  // entry modal
  entryOpen: boolean;
  entryTab: EntryTab;
  entryDate: string;
  openEntry: (opts?: { tab?: EntryTab; date?: string }) => void;
  closeEntry: () => void;
  setEntryTab: (t: EntryTab) => void;

  // memo scanner: photo of a memo (receipt) -> one expense per item, or a
  // screenshot of notes -> its expenses and income
  memoOpen: boolean;
  openMemo: () => void;
  closeMemo: () => void;

  // list scanner: screenshot of a list -> tickets on the selected board of a kind
  listScan: BoardKind | null;
  openListScan: (kind: BoardKind) => void;
  closeListScan: () => void;
  /** The board last opened per kind (this browser), shared by the board page and the list scanner. */
  selectedBoards: Record<BoardKind, string | null>;
  selectBoard: (kind: BoardKind, id: string) => void;

  // Vault Mode: when on, every income also adds to the savings pool and every
  // expense draws from it, so savings reflect true net flow.
  vaultMode: boolean;
  setVaultMode: (on: boolean) => void;

  // Dashboard sections hidden in Settings (null until read from storage). Hiding
  // only changes what the dashboard renders — the data behind it is untouched.
  dashboardHidden: DashboardSectionId[] | null;
  setDashboardHidden: (ids: DashboardSectionId[]) => void;

  // The interface language (English or Bangla — shared with the Android app).
  lang: Lang;
  setLanguage: (l: Lang) => void;

  // The account's currency (BDT unless changed in Settings) and reminder settings.
  currency: string;
  setCurrencyCode: (code: string) => void;
  reminders: ReminderPrefs;
  setReminders: (r: ReminderPrefs) => void;

  // short notices at the bottom of the screen
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;

  // money / mood
  addMoney: (t: NewTransaction) => Promise<Transaction>;
  /** Saves new values for a transaction; everything computed from the ledger follows. */
  editMoney: (id: string, t: NewTransaction) => Promise<void>;
  removeMoney: (id: string) => Promise<void>;
  saveMood: (m: NewMoodLog) => Promise<void>;
  moodsForDate: (k: string) => MoodLog[];
  avgMoodForDate: (k: string) => number | null;

  // categories
  createCategory: (c: NewCategory) => Promise<Category>;
  editCategory: (id: string, p: Partial<NewCategory>) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;

  // budgets
  createBudget: (b: NewBudget) => Promise<void>;
  editBudget: (id: string, p: Partial<NewBudget>) => Promise<void>;
  removeBudget: (id: string) => Promise<void>;

  // goals
  createGoal: (g: NewGoal) => Promise<void>;
  editGoal: (id: string, p: Partial<NewGoal>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;

  // bills
  createBill: (b: NewBill) => Promise<void>;
  editBill: (id: string, p: Partial<NewBill>) => Promise<void>;
  removeBill: (id: string) => Promise<void>;
  /** Logs the bill as an expense and moves a repeating bill to its next due date. */
  payBill: (id: string) => Promise<BillPayment>;
  /** Takes a payment back: removes its expense and restores the bill. */
  undoBillPayment: (p: BillPayment) => Promise<void>;
  /** A paid one-off bill back to unpaid, optionally removing the expense it logged. */
  unpayBill: (id: string, removeExpense: boolean) => Promise<void>;

  // wallets + transfers
  createWallet: (w: NewWallet) => Promise<Wallet>;
  editWallet: (id: string, p: Partial<NewWallet>) => Promise<void>;
  removeWallet: (id: string) => Promise<void>;
  /** A transfer between two wallets; a fee (bKash cash-out etc.) is logged as an expense. */
  createTransfer: (t: NewTransfer, fee?: number) => Promise<void>;
  removeTransfer: (id: string) => Promise<void>;

  // dhar / baki
  createDebt: (d: NewDebt) => Promise<Debt>;
  editDebt: (id: string, p: Partial<NewDebt>) => Promise<void>;
  removeDebt: (id: string) => Promise<void>;
  /** A part (or full) payment; a debt that's paid off closes itself. */
  recordDebtPayment: (p: NewDebtPayment) => Promise<void>;
  removeDebtPayment: (id: string) => Promise<void>;

  // recurring income and expenses: each due date is logged by itself
  createRecurring: (r: RecurringInput) => Promise<RecurringRule>;
  /** Saves changes; a new schedule starts again from today. */
  editRecurring: (id: string, r: RecurringInput) => Promise<void>;
  /** Paused rules log nothing; resuming carries on from today (missed dates stay missed). */
  pauseRecurring: (id: string, paused: boolean) => Promise<void>;
  /** The rule goes; entries it logged stay in the ledger. */
  removeRecurring: (id: string) => Promise<void>;

  // challenges
  createChallenge: (c: NewChallenge) => Promise<Challenge>;
  removeChallenge: (id: string) => Promise<void>;

  // journal
  createJournal: (j: NewJournalEntry) => Promise<void>;
  removeJournal: (id: string) => Promise<void>;

  // activities
  createActivity: (a: NewActivity) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;
  toggleActivity: (activityId: string, dateKey: string) => Promise<void>;

  // boards (to-do + to-buy): a new board starts with its kind's default columns
  createBoard: (name: string, kind: BoardKind) => Promise<{ board: Board; columns: BoardColumn[] }>;
  renameBoard: (id: string, name: string) => Promise<void>;
  removeBoard: (id: string) => Promise<void>;
  createColumn: (boardId: string, name: string) => Promise<void>;
  renameColumn: (id: string, name: string) => Promise<void>;
  moveColumn: (id: string, dir: -1 | 1) => Promise<void>;
  placeColumn: (id: string, index: number) => Promise<void>;
  removeColumn: (id: string) => Promise<void>;
  createTicket: (columnId: string, fields: Partial<TicketFields> & { title: string }) => Promise<Ticket>;
  editTicket: (id: string, patch: Partial<TicketFields>) => Promise<void>;
  /** Put a ticket in `columnId` where it sits in `order` (that column's ids, top to bottom). */
  placeTicket: (id: string, columnId: string, order: string[]) => Promise<void>;
  removeTicket: (id: string) => Promise<void>;
  /** Several tickets at once (a scanned list), each to the bottom of its column, numbered in order. */
  addTickets: (boardId: string, items: { columnId: string; fields: Partial<TicketFields> & { title: string } }[]) => Promise<Ticket[]>;
  removeTickets: (ids: string[]) => Promise<void>;
}

const Ctx = createContext<AppDataValue | null>(null);

/** Categories in the database's order: by kind, then sort, then name — a new
 *  category gets the lowest sort of its kind, so it comes first. */
function orderCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => a.kind.localeCompare(b.kind) || a.sort - b.sort || a.name.localeCompare(b.name));
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [moods, setMoods] = useState<MoodLog[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardColumns, setBoardColumns] = useState<BoardColumn[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [walletsReady, setWalletsReady] = useState(false);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [recurringReady, setRecurringReady] = useState(false);

  // ---- notices
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const dismissToast = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  const pushToast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++toastId.current;
      setToasts((p) => [...p.slice(-2), { ...t, id }]);
      setTimeout(() => dismissToast(id), t.action ? 8000 : 6000);
    },
    [dismissToast],
  );

  // ---- language, currency, reminders (account preferences, local copy first)
  const [lang, setLangState] = useState<Lang>("en");
  const [currency, setCurrencyState] = useState("BDT");
  const [reminders, setRemindersState] = useState<ReminderPrefs>(DEFAULT_REMINDERS);
  const prefsTouched = useRef<Set<string>>(new Set());
  useEffect(() => {
    // After the first paint, so the first render matches the server's (English) HTML.
    setLangState(setLang(storedLang()));
    try {
      const code = localStorage.getItem("currency");
      if (code) setCurrencyState(setCurrency(code).code);
      const r = localStorage.getItem("reminders");
      if (r) setRemindersState(parseReminders(JSON.parse(r)));
    } catch {
      /* ignore */
    }
    loadPrefs()
      .then((meta) => {
        if (!prefsTouched.current.has("currency") && typeof meta.currency === "string") {
          setCurrencyState(setCurrency(meta.currency).code);
          try {
            localStorage.setItem("currency", meta.currency);
          } catch {
            /* ignore */
          }
        }
        if (!prefsTouched.current.has("lang") && (meta.lang === "en" || meta.lang === "bn")) {
          setLangState(setLang(meta.lang));
          rememberLang(asLang(meta.lang));
        }
        if (!prefsTouched.current.has("reminders") && meta.reminders) {
          const r = parseReminders(meta.reminders);
          setRemindersState(r);
          try {
            localStorage.setItem("reminders", JSON.stringify(r));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* the dashboard-sections loader already logs this */
      });
  }, []);
  const setLanguage = useCallback((l: Lang) => {
    prefsTouched.current.add("lang");
    setLangState(setLang(l));
    rememberLang(l);
    savePrefs({ lang: l }).catch((err) => console.warn("[catalyst] could not save the language", err));
  }, []);
  const setCurrencyCode = useCallback((code: string) => {
    prefsTouched.current.add("currency");
    const c = setCurrency(code);
    setCurrencyState(c.code);
    try {
      localStorage.setItem("currency", c.code);
    } catch {
      /* ignore */
    }
    savePrefs({ currency: c.code }).catch((err) => console.warn("[catalyst] could not save the currency", err));
  }, []);
  const setReminders = useCallback((r: ReminderPrefs) => {
    prefsTouched.current.add("reminders");
    setRemindersState(r);
    try {
      localStorage.setItem("reminders", JSON.stringify(r));
    } catch {
      /* ignore */
    }
    savePrefs({ reminders: r }).catch((err) => console.warn("[catalyst] could not save reminders", err));
  }, []);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryTab, setEntryTab] = useState<EntryTab>("money");
  const [entryDate, setEntryDate] = useState<string>(toDateKey(new Date()));
  const [memoOpen, setMemoOpen] = useState(false);
  const [listScan, setListScan] = useState<BoardKind | null>(null);
  const [selectedBoards, setSelectedBoards] = useState<Record<BoardKind, string | null>>({ todo: null, shopping: null });
  useEffect(() => {
    try {
      setSelectedBoards({ todo: localStorage.getItem("board:todo"), shopping: localStorage.getItem("board:shopping") });
    } catch {
      /* ignore */
    }
  }, []);
  const selectBoard = useCallback((kind: BoardKind, id: string) => {
    setSelectedBoards((p) => ({ ...p, [kind]: id }));
    try {
      localStorage.setItem(`board:${kind}`, id);
    } catch {
      /* ignore */
    }
  }, []);

  const [vaultMode, setVaultModeState] = useState(false);
  useEffect(() => {
    try {
      setVaultModeState(localStorage.getItem("vaultMode") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const setVaultMode = useCallback((on: boolean) => {
    setVaultModeState(on);
    try {
      localStorage.setItem("vaultMode", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const [dashboardHidden, setDashboardHiddenState] = useState<DashboardSectionId[] | null>(null);
  const dashboardTouched = useRef(false);
  const dashboardSave = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    // Local copy first so the dashboard renders right away, then the account copy
    // (authoritative — it follows the user across devices) unless they already
    // changed something this session.
    let local: DashboardSectionId[] = [];
    try {
      local = parseHiddenSections(JSON.parse(localStorage.getItem(DASHBOARD_HIDDEN) ?? "[]")) ?? [];
    } catch {
      /* ignore */
    }
    setDashboardHiddenState(local);
    loadPrefs()
      .then((meta) => {
        if (dashboardTouched.current) return;
        const remote = parseHiddenSections(meta[DASHBOARD_HIDDEN]) ?? [];
        setDashboardHiddenState(remote);
        try {
          localStorage.setItem(DASHBOARD_HIDDEN, JSON.stringify(remote));
        } catch {
          /* ignore */
        }
      })
      .catch((err) => console.warn("[catalyst] could not load preferences", err));
  }, []);
  const setDashboardHidden = useCallback((ids: DashboardSectionId[]) => {
    dashboardTouched.current = true;
    setDashboardHiddenState(ids);
    try {
      localStorage.setItem(DASHBOARD_HIDDEN, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
    // Chain saves so rapid toggles reach the server in order (last write wins).
    dashboardSave.current = dashboardSave.current
      .then(() => savePrefs({ [DASHBOARD_HIDDEN]: ids }))
      .catch((err) => console.warn("[catalyst] could not save preferences", err));
  }, []);

  const didInit = useRef(false);
  useEffect(() => {
    // Run exactly once for the provider's lifetime — even under React StrictMode's
    // double-invoke (which would otherwise double-seed categories). We deliberately
    // do NOT gate setState on an `alive` flag here: StrictMode's cleanup would cancel
    // the single run and leave state empty.
    if (didInit.current) return;
    didInit.current = true;
    // Load each collection independently so a missing table degrades gracefully
    // (e.g. before the SQL migration is run) instead of breaking the whole app.
    const safe = async <T,>(fn: () => Promise<T>, fallback: T, name: string): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        console.warn(`[catalyst] could not load ${name} — run db/supabase.sql?`, err);
        return fallback;
      }
    };
    (async () => {
      // Wallets need the newer database update; until it's run they're simply off.
      const walletLoad = listWallets()
        .then(async (list) => ({ ready: true, list: list.length ? list : await seedDefaultWallets() }))
        .catch((err) => {
          console.warn("[catalyst] wallets unavailable — run db/supabase.sql?", err);
          return { ready: false, list: [] as Wallet[] };
        });
      // Recurring entries and challenges need the 1.5 database update; until then they're off.
      const newer = Promise.all([listRecurring(), listChallenges()])
        .then(([rules, list]) => ({ ready: true, rules, list }))
        .catch((err) => {
          console.warn("[catalyst] recurring entries and challenges unavailable — run db/supabase.sql?", err);
          return { ready: false, rules: [] as RecurringRule[], list: [] as Challenge[] };
        });
      const [cats, txs, mds, bgs, gls, bls, jnl, acts, alogs, brds, bcols, tks, wl, trs, dbs, dps, nw] = await Promise.all([
        safe(listCategories, [] as Category[], "categories"),
        safe(listTransactions, [] as Transaction[], "transactions"),
        safe(listMoods, [] as MoodLog[], "moods"),
        safe(listBudgets, [] as Budget[], "budgets"),
        safe(listGoals, [] as Goal[], "goals"),
        safe(listBills, [] as Bill[], "bills"),
        safe(listJournal, [] as JournalEntry[], "journal"),
        safe(listActivities, [] as Activity[], "activities"),
        safe(listActivityLogs, [] as ActivityLog[], "activityLogs"),
        safe(listBoards, [] as Board[], "boards"),
        safe(listBoardColumns, [] as BoardColumn[], "boardColumns"),
        safe(listTickets, [] as Ticket[], "tickets"),
        walletLoad,
        safe(listTransfers, [] as Transfer[], "transfers"),
        safe(listDebts, [] as Debt[], "debts"),
        safe(listDebtPayments, [] as DebtPayment[], "debtPayments"),
        newer,
      ]);
      let finalCats = cats;
      if (cats.length === 0) {
        finalCats = await safe(seedDefaultCategories, [] as Category[], "seedCategories");
      }
      // Defensive de-dupe by kind+name (hides any duplicate rows from older double-seeds).
      const seen = new Set<string>();
      finalCats = finalCats.filter((c) => {
        const key = `${c.kind}:${c.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Ensure the special "Break saving" expense category exists (used to pull from savings).
      const hasBreakSaving = finalCats.some(
        (c) => c.kind === "expense" && c.name.toLowerCase() === BREAK_SAVING.toLowerCase(),
      );
      if (!hasBreakSaving) {
        try {
          const created = await addCategory({
            name: BREAK_SAVING,
            kind: "expense",
            color: "#3D80BC",
            sort: finalCats.filter((c) => c.kind === "expense").length,
          });
          finalCats = [...finalCats, created];
        } catch (err) {
          console.warn("[catalyst] could not ensure Break saving category", err);
        }
      }
      setCategories(finalCats);
      setTransactions(txs);
      setMoods(mds);
      setBudgets(bgs);
      setGoals(gls);
      setBills(bls);
      setJournal(jnl);
      setActivities(acts);
      setActivityLogs(alogs);
      setBoards(brds);
      setBoardColumns(bcols);
      setTickets(tks);
      setWallets(wl.list);
      setWalletsReady(wl.ready);
      setTransfers(trs);
      setDebts(dbs);
      setDebtPayments(dps);
      setRecurring(nw.rules);
      setChallenges(nw.list);
      setRecurringReady(nw.ready);
      setLoading(false);
    })();
  }, []);

  const openEntry = useCallback((opts?: { tab?: EntryTab; date?: string }) => {
    if (opts?.tab) setEntryTab(opts.tab);
    setEntryDate(opts?.date ?? toDateKey(new Date()));
    setEntryOpen(true);
  }, []);
  const closeEntry = useCallback(() => setEntryOpen(false), []);
  const openMemo = useCallback(() => {
    setEntryOpen(false);
    setMemoOpen(true);
  }, []);
  const closeMemo = useCallback(() => setMemoOpen(false), []);
  const openListScan = useCallback((kind: BoardKind) => {
    setEntryOpen(false);
    setMemoOpen(false);
    setListScan(kind);
  }, []);
  const closeListScan = useCallback(() => setListScan(null), []);

  // Budget alerts: when an expense takes a budget past 80% or 100% this month —
  // each level once per budget per month.
  const txRef = useRef(transactions);
  txRef.current = transactions;
  const budgetsRef = useRef(budgets);
  budgetsRef.current = budgets;
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  const moodsRef = useRef(moods);
  moodsRef.current = moods;

  // Mood-spend alert: a lot spent on a low day — once a day.
  const checkMoodSpend = useCallback(
    (txs: Transaction[], mds: MoodLog[]) => {
      if (!remindersRef.current.moodSpend) return;
      const today = toDateKey(new Date());
      const key = `mood-spend:${today}`;
      if (readJson(key, false)) return;
      const alert = moodSpendAlert(txs, mds, today);
      if (!alert) return;
      writeJson(key, true);
      pushToast({
        tone: "warn",
        message: tr("You've spent {amount} today on a low day — about {ratio}× your usual.", {
          amount: formatCurrency(alert.spent),
          ratio: alert.ratio,
        }),
      });
    },
    [pushToast],
  );
  const checkBudgets = useCallback(
    (before: Transaction[], after: Transaction[]) => {
      if (!remindersRef.current.budgets) return;
      const month = toDateKey(new Date()).slice(0, 7);
      let seen: string[] = [];
      try {
        seen = JSON.parse(localStorage.getItem(`budget-alerts:${month}`) ?? "[]");
      } catch {
        /* ignore */
      }
      for (const b of budgetsRef.current) {
        const was = budgetUse(b, before).ratio;
        const { ratio, spent } = budgetUse(b, after);
        const level = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : 0;
        const key = `${b.id}:${level}`;
        if (!level || was >= level / 100 || seen.includes(key)) continue;
        seen.push(key);
        pushToast({
          tone: "warn",
          message:
            level === 100
              ? `${b.categoryName} budget is used up: ${formatCurrency(spent)} of ${formatCurrency(b.amount)} this month.`
              : `${b.categoryName} budget is ${Math.round(ratio * 100)}% used: ${formatCurrency(spent)} of ${formatCurrency(b.amount)}.`,
        });
      }
      try {
        localStorage.setItem(`budget-alerts:${month}`, JSON.stringify(seen));
      } catch {
        /* ignore */
      }
    },
    [pushToast],
  );

  const addMoney = useCallback(
    async (t: NewTransaction) => {
      const c = await addTransaction(t);
      const before = txRef.current;
      const after = [c, ...before].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
      txRef.current = after;
      setTransactions(after);
      if (c.kind === "expense") {
        checkBudgets(before, after);
        checkMoodSpend(after, moodsRef.current);
      }
      return c;
    },
    [checkBudgets, checkMoodSpend],
  );
  const editMoney = useCallback(
    async (id: string, t: NewTransaction) => {
      const c = await updateTransaction(id, t);
      const before = txRef.current;
      // Same order as the database list: newest day first, then newest added.
      const after = before
        .map((x) => (x.id === id ? c : x))
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt));
      txRef.current = after;
      setTransactions(after);
      if (c.kind === "expense") checkBudgets(before, after);
    },
    [checkBudgets],
  );
  const removeMoney = useCallback(async (id: string) => {
    await deleteTransaction(id);
    setTransactions((p) => p.filter((t) => t.id !== id));
  }, []);
  const saveMood = useCallback(
    async (m: NewMoodLog) => {
      const s = await addMood(m);
      const after = [s, ...moodsRef.current].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
      moodsRef.current = after;
      setMoods(after);
      if (s.mood <= 2) checkMoodSpend(txRef.current, after);
    },
    [checkMoodSpend],
  );
  const moodsForDate = useCallback(
    (k: string) => moods.filter((m) => m.loggedOn === k).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
    [moods],
  );
  const avgMoodForDate = useCallback(
    (k: string) => {
      const day = moods.filter((m) => m.loggedOn === k);
      if (!day.length) return null;
      return Math.round((day.reduce((s, m) => s + m.mood, 0) / day.length) * 10) / 10;
    },
    [moods],
  );

  const createCategory = useCallback(async (c: NewCategory) => {
    const x = await addCategory(c);
    setCategories((p) => orderCategories([...p, x]));
    return x;
  }, []);
  const editCategory = useCallback(async (id: string, patch: Partial<NewCategory>) => {
    await updateCategory(id, patch);
    setCategories((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);
  const removeCategory = useCallback(async (id: string) => {
    await deleteCategory(id);
    setCategories((p) => p.filter((c) => c.id !== id));
  }, []);

  const createBudget = useCallback(async (b: NewBudget) => {
    const x = await addBudget(b);
    setBudgets((p) => [...p, x]);
  }, []);
  const editBudget = useCallback(async (id: string, patch: Partial<NewBudget>) => {
    await updateBudget(id, patch);
    setBudgets((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);
  const removeBudget = useCallback(async (id: string) => {
    await deleteBudget(id);
    setBudgets((p) => p.filter((b) => b.id !== id));
  }, []);

  const createGoal = useCallback(async (g: NewGoal) => {
    const x = await addGoal(g);
    setGoals((p) => [...p, x]);
  }, []);
  const editGoal = useCallback(async (id: string, patch: Partial<NewGoal>) => {
    await updateGoal(id, patch);
    setGoals((p) => p.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }, []);
  const removeGoal = useCallback(async (id: string) => {
    await deleteGoal(id);
    setGoals((p) => p.filter((g) => g.id !== id));
  }, []);

  const createBill = useCallback(async (b: NewBill) => {
    const x = await addBill(b);
    setBills((p) => [...p, x].sort((a, b2) => a.dueOn.localeCompare(b2.dueOn)));
  }, []);
  const editBill = useCallback(async (id: string, patch: Partial<NewBill>) => {
    await updateBill(id, patch);
    setBills((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);
  const removeBill = useCallback(async (id: string) => {
    await deleteBill(id);
    setBills((p) => p.filter((b) => b.id !== id));
  }, []);
  const billsRef = useRef(bills);
  billsRef.current = bills;
  const sortBills = (list: Bill[]) => [...list].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const payBill = useCallback(
    async (id: string): Promise<BillPayment> => {
      const bill = billsRef.current.find((b) => b.id === id);
      if (!bill) throw new Error("That bill no longer exists.");
      const cat = billCategory(bill, categories);
      const today = toDateKey(new Date());
      const txn = await addMoney({
        kind: "expense",
        amount: bill.amount,
        categoryId: cat?.id ?? null,
        categoryName: cat?.name ?? "Other",
        place: "",
        note: bill.name,
        occurredOn: today,
        occurredAt: combineDateTime(today, nowTime()),
        walletId: bill.walletId ?? defaultWallet(wallets)?.id ?? null,
      });
      const before = { dueOn: bill.dueOn, isPaid: bill.isPaid, lastPaidTxn: bill.lastPaidTxn };
      const next = nextDue(bill.dueOn, bill.recurrence);
      // A repeating bill moves to its next due date (still unpaid); a one-off is done.
      const patch: Partial<NewBill> = next ? { dueOn: next, isPaid: false } : { isPaid: true };
      if (walletsReady) patch.lastPaidTxn = txn.id;
      await updateBill(id, patch);
      setBills((p) => sortBills(p.map((b) => (b.id === id ? { ...b, ...patch } : b))));
      return { billId: id, txnId: txn.id, before };
    },
    [addMoney, categories, wallets, walletsReady],
  );
  const undoBillPayment = useCallback(
    async ({ billId, txnId, before }: BillPayment) => {
      const patch: Partial<NewBill> = { dueOn: before.dueOn, isPaid: before.isPaid };
      if (walletsReady) patch.lastPaidTxn = before.lastPaidTxn;
      await updateBill(billId, patch);
      setBills((p) => sortBills(p.map((b) => (b.id === billId ? { ...b, ...patch } : b))));
      await deleteTransaction(txnId);
      setTransactions((p) => p.filter((t) => t.id !== txnId));
    },
    [walletsReady],
  );
  const unpayBill = useCallback(
    async (id: string, removeExpense: boolean) => {
      const bill = billsRef.current.find((b) => b.id === id);
      if (!bill) return;
      const patch: Partial<NewBill> = { isPaid: false };
      if (walletsReady && bill.lastPaidTxn) patch.lastPaidTxn = null;
      await updateBill(id, patch);
      setBills((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)));
      if (removeExpense && bill.lastPaidTxn) {
        const txnId = bill.lastPaidTxn;
        await deleteTransaction(txnId);
        setTransactions((p) => p.filter((t) => t.id !== txnId));
      }
    },
    [walletsReady],
  );

  // ---- wallets + transfers
  const createWallet = useCallback(async (w: NewWallet) => {
    const x = await addWallet(w);
    setWallets((p) => [...p, x].sort((a, b) => a.sort - b.sort));
    return x;
  }, []);
  const editWallet = useCallback(async (id: string, patch: Partial<NewWallet>) => {
    await updateWallet(id, patch);
    setWallets((p) => p.map((w) => (w.id === id ? { ...w, ...patch } : w)).sort((a, b) => a.sort - b.sort));
  }, []);
  const removeWallet = useCallback(async (id: string) => {
    await deleteWallet(id); // entries move to the default wallet; its transfers go
    setWallets((p) => p.filter((w) => w.id !== id));
    setTransfers((p) => p.filter((t) => t.fromWallet !== id && t.toWallet !== id));
    setTransactions((p) => p.map((t) => (t.walletId === id ? { ...t, walletId: null } : t)));
    setDebts((p) => p.map((d) => (d.walletId === id ? { ...d, walletId: null } : d)));
    setDebtPayments((p) => p.map((x) => (x.walletId === id ? { ...x, walletId: null } : x)));
    setBills((p) => p.map((b) => (b.walletId === id ? { ...b, walletId: null } : b)));
  }, []);
  const createTransfer = useCallback(
    async (t: NewTransfer, fee?: number) => {
      const x = await addTransfer(t);
      setTransfers((p) => [x, ...p].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)));
      if (fee && fee > 0) {
        const from = wallets.find((w) => w.id === t.fromWallet);
        const cat =
          categories.find((c) => c.kind === "expense" && /^(fees?|charges?)$/i.test(c.name)) ??
          categories.find((c) => c.kind === "expense" && c.name.toLowerCase() === "other");
        await addMoney({
          kind: "expense",
          amount: Math.round(fee * 100) / 100,
          categoryId: cat?.id ?? null,
          categoryName: cat?.name ?? "Other",
          place: "",
          note: `${from?.name ?? "Transfer"} fee`,
          occurredOn: t.occurredOn,
          occurredAt: t.occurredAt,
          walletId: t.fromWallet,
        });
      }
    },
    [addMoney, categories, wallets],
  );
  const removeTransfer = useCallback(async (id: string) => {
    await deleteTransfer(id);
    setTransfers((p) => p.filter((t) => t.id !== id));
  }, []);

  // ---- dhar / baki
  const createDebt = useCallback(async (d: NewDebt) => {
    const x = await addDebt(d);
    setDebts((p) => [x, ...p]);
    return x;
  }, []);
  const editDebt = useCallback(async (id: string, patch: Partial<NewDebt>) => {
    await updateDebt(id, patch);
    setDebts((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);
  const removeDebt = useCallback(async (id: string) => {
    await deleteDebt(id); // its payments go with it
    setDebts((p) => p.filter((d) => d.id !== id));
    setDebtPayments((p) => p.filter((x) => x.debtId !== id));
  }, []);
  const debtsRef = useRef(debts);
  debtsRef.current = debts;
  const paymentsRef = useRef(debtPayments);
  paymentsRef.current = debtPayments;
  const recordDebtPayment = useCallback(async (input: NewDebtPayment) => {
    const x = await addDebtPayment(input);
    const payments = [...paymentsRef.current, x];
    paymentsRef.current = payments;
    setDebtPayments(payments);
    const debt = debtsRef.current.find((d) => d.id === input.debtId);
    if (debt && !debt.closed && debtRemaining(debt, payments) <= 0) {
      await updateDebt(debt.id, { closed: true });
      setDebts((p) => p.map((d) => (d.id === debt.id ? { ...d, closed: true } : d)));
    }
  }, []);
  const removeDebtPayment = useCallback(async (id: string) => {
    const pay = paymentsRef.current.find((x) => x.id === id);
    await deleteDebtPayment(id);
    const payments = paymentsRef.current.filter((x) => x.id !== id);
    paymentsRef.current = payments;
    setDebtPayments(payments);
    // Taking a payment back reopens a debt it had closed.
    const debt = pay && debtsRef.current.find((d) => d.id === pay.debtId);
    if (debt && debt.closed && debtRemaining(debt, payments) > 0) {
      await updateDebt(debt.id, { closed: false });
      setDebts((p) => p.map((d) => (d.id === debt.id ? { ...d, closed: false } : d)));
    }
  }, []);

  // ---- recurring income and expenses
  const recurringRef = useRef(recurring);
  recurringRef.current = recurring;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const running = useRef(false);

  /** Log every date that's come due (whoever logs a date first, it's in the
   *  ledger once), move each rule on, and say what was added. */
  const runRecurring = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const added: Transaction[] = [];
      let elsewhere = false;
      for (const rule of recurringRef.current) {
        const { day, time } = zonedNow(rule.tz);
        let last: string | null = null;
        for (const date of dueDates(rule, day, time)) {
          const cat = ruleCategory(rule, categoriesRef.current);
          try {
            const t = await logRecurring(rule.id, date, {
              kind: rule.kind,
              amount: rule.amount,
              categoryId: cat?.id ?? null,
              categoryName: cat?.name ?? "Other",
              place: "",
              note: rule.name,
              occurredOn: date,
              occurredAt: zonedIso(date, rule.time, rule.tz),
              walletId: rule.walletId ?? defaultWallet(walletsRef.current)?.id ?? null,
            });
            if (t) added.push(t);
            else elsewhere = true; // the app or the reminders job got there first
            last = date;
          } catch (err) {
            console.warn("[catalyst] could not log a recurring entry", err);
            break;
          }
        }
        if (!last) continue;
        const next = nextAfterLogged(rule, last);
        try {
          await advanceRecurring(rule.id, next);
        } catch (err) {
          console.warn("[catalyst] could not move a recurring entry on", err);
        }
        setRecurring((p) => p.map((r) => (r.id === rule.id && next > r.nextOn ? { ...r, nextOn: next } : r)));
      }
      if (added.length) {
        const before = txRef.current;
        const after = [...added, ...before].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt));
        txRef.current = after;
        setTransactions(after);
        if (added.some((t) => t.kind === "expense")) checkBudgets(before, after);
        if (remindersRef.current.recurring) {
          const signed = (t: Transaction) => formatCurrency(t.kind === "income" ? t.amount : -t.amount, { sign: true });
          pushToast({
            message:
              added.length === 1
                ? tr("Added automatically: {name} {amount}", { name: added[0].note, amount: signed(added[0]) })
                : tr("{n} recurring entries added: {names}", { n: added.length, names: [...new Set(added.map((t) => t.note))].join(", ") }),
          });
        }
      }
      if (elsewhere) {
        // Pick up what another device logged meanwhile.
        const fresh = await listTransactions().catch(() => null);
        if (fresh) {
          txRef.current = fresh;
          setTransactions(fresh);
        }
      }
    } finally {
      running.current = false;
    }
  }, [checkBudgets, pushToast]);

  // Run once everything has loaded, then every minute and whenever the tab comes back.
  useEffect(() => {
    if (loading || !recurringReady) return;
    void runRecurring();
    const tick = setInterval(() => void runRecurring(), 60_000);
    const back = () => document.visibilityState === "visible" && void runRecurring();
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", back);
    };
  }, [loading, recurringReady, runRecurring]);

  const scheduleOf = (r: RecurringInput): Schedule => ({
    frequency: r.frequency,
    every: r.every,
    day1: r.day1,
    day2: r.day2,
    time: r.time,
    startOn: r.startOn,
    endOn: r.endOn,
  });
  const createRecurring = useCallback(
    async (input: RecurringInput) => {
      // From its start date — a start in the past logs the dates since then too.
      const x = await addRecurring({ ...input, nextOn: firstNextOn(scheduleOf(input), input.startOn), tz: deviceTz(), paused: false });
      const list = [...recurringRef.current, x];
      recurringRef.current = list;
      setRecurring(list);
      void runRecurring();
      return x;
    },
    [runRecurring],
  );
  const editRecurring = useCallback(
    async (id: string, input: RecurringInput) => {
      const was = recurringRef.current.find((r) => r.id === id);
      if (!was) return;
      const patch: Partial<NewRecurringRule> = { ...input };
      if (!sameSchedule(scheduleOf(input), was)) {
        // A new schedule carries on from today, in this device's timezone.
        const tz = deviceTz();
        const today = zonedNow(tz).day;
        Object.assign(patch, { tz, nextOn: firstNextOn(scheduleOf(input), today > input.startOn ? today : input.startOn) });
      }
      await updateRecurring(id, patch);
      const list = recurringRef.current.map((r) => (r.id === id ? { ...r, ...patch } : r));
      recurringRef.current = list;
      setRecurring(list);
      void runRecurring();
    },
    [runRecurring],
  );
  const pauseRecurring = useCallback(
    async (id: string, paused: boolean) => {
      const was = recurringRef.current.find((r) => r.id === id);
      if (!was) return;
      const patch: Partial<NewRecurringRule> = { paused };
      if (!paused) {
        const today = zonedNow(was.tz).day;
        patch.nextOn = firstNextOn(was, today > was.startOn ? today : was.startOn);
      }
      await updateRecurring(id, patch);
      const list = recurringRef.current.map((r) => (r.id === id ? { ...r, ...patch } : r));
      recurringRef.current = list;
      setRecurring(list);
      if (!paused) void runRecurring();
    },
    [runRecurring],
  );
  const removeRecurring = useCallback(async (id: string) => {
    await deleteRecurring(id); // its entries stay; the database forgets which rule logged them
    setRecurring((p) => p.filter((r) => r.id !== id));
    setTransactions((p) => p.map((t) => (t.recurringId === id ? { ...t, recurringId: null } : t)));
  }, []);

  // ---- challenges
  const createChallenge = useCallback(async (c: NewChallenge) => {
    const x = await addChallenge(c);
    setChallenges((p) => [x, ...p]);
    return x;
  }, []);
  const removeChallenge = useCallback(async (id: string) => {
    await deleteChallenge(id);
    setChallenges((p) => p.filter((c) => c.id !== id));
  }, []);

  // Streak milestones, and challenges won, lost or on their last day — each said
  // once on this browser (Settings → Notifications can turn them off).
  useEffect(() => {
    if (loading) return;
    const today = toDateKey(new Date());
    if (reminders.streaks) {
      const s = streakOf(loggedDays(transactions, moods), today);
      const m = streakMilestone(s.current);
      const seen = readJson<{ since: string | null; milestone: number }>("streak-celebrated", { since: null, milestone: 0 });
      const before = seen.since === s.since ? seen.milestone : 0;
      if (m > before) {
        writeJson("streak-celebrated", { since: s.since, milestone: m });
        // Only while it's fresh (reached today or yesterday) — not for an old streak on first look.
        if (s.current - m <= 1) pushToast({ message: tr("{n}-day streak! You've logged something every day for {n} days.", { n: m }) });
      }
    }
    if (reminders.challenges && challenges.length) {
      const told = readJson<Record<string, string>>("challenge-notified", {});
      let changed = false;
      for (const c of challenges) {
        const p = challengeProgress(c, transactions, moods, today);
        const title = challengeTitle(c, tr, formatCurrency);
        const say = p.status === "won" ? "won" : p.status === "lost" ? "lost" : p.status === "active" && p.daysLeft === 1 ? "last" : "";
        if (!say || told[c.id] === say || (say === "last" && told[c.id])) continue;
        told[c.id] = say;
        changed = true;
        pushToast({
          tone: say === "lost" ? "warn" : "info",
          message:
            say === "won"
              ? tr("Challenge done: {title}. Well done!", { title })
              : say === "lost"
                ? tr("Challenge missed: {title}. Try again?", { title })
                : tr("Last day of your challenge: {title}.", { title }),
        });
      }
      if (changed) writeJson("challenge-notified", told);
    }
  }, [loading, transactions, moods, challenges, reminders.streaks, reminders.challenges, pushToast]);

  const createJournal = useCallback(async (j: NewJournalEntry) => {
    const x = await addJournal(j);
    setJournal((p) => [x, ...p].sort((a, b) => b.entryOn.localeCompare(a.entryOn)));
  }, []);
  const removeJournal = useCallback(async (id: string) => {
    await deleteJournal(id);
    setJournal((p) => p.filter((j) => j.id !== id));
  }, []);

  const createActivity = useCallback(async (a: NewActivity) => {
    const x = await addActivity(a);
    setActivities((p) => [...p, x]);
  }, []);
  const removeActivity = useCallback(async (id: string) => {
    await deleteActivity(id);
    setActivities((p) => p.filter((a) => a.id !== id));
    setActivityLogs((p) => p.filter((l) => l.activityId !== id));
  }, []);
  const toggleActivity = useCallback(
    async (activityId: string, dateKey: string) => {
      const existing = activityLogs.find((l) => l.activityId === activityId && l.loggedOn === dateKey);
      if (existing) {
        await deleteActivityLog(existing.id);
        setActivityLogs((p) => p.filter((l) => l.id !== existing.id));
      } else {
        const x = await addActivityLog(activityId, dateKey);
        setActivityLogs((p) => [...p, x]);
      }
    },
    [activityLogs],
  );

  const createBoard = useCallback(
    async (name: string, kind: BoardKind) => {
      const board = await addBoard({ name, kind, sort: boards.length });
      setBoards((p) => [...p, board]);
      let columns: BoardColumn[] = [];
      try {
        columns = await addBoardColumns(
          DEFAULT_BOARD_COLUMNS[kind].map((n, i) => ({ boardId: board.id, name: n, sort: i })),
        );
        setBoardColumns((p) => [...p, ...columns]);
      } catch (err) {
        // The board still works — its columns can be added by hand.
        console.warn("[catalyst] could not add the new board's columns", err);
      }
      return { board, columns };
    },
    [boards.length],
  );
  const renameBoard = useCallback(async (id: string, name: string) => {
    await updateBoard(id, { name });
    setBoards((p) => p.map((b) => (b.id === id ? { ...b, name } : b)));
  }, []);
  const removeBoard = useCallback(async (id: string) => {
    await deleteBoard(id); // the database removes its columns and tickets too
    setBoards((p) => p.filter((b) => b.id !== id));
    setBoardColumns((p) => p.filter((c) => c.boardId !== id));
    setTickets((p) => p.filter((t) => t.boardId !== id));
  }, []);

  const createColumn = useCallback(
    async (boardId: string, name: string) => {
      const last = boardColumns.filter((c) => c.boardId === boardId).reduce((m, c) => Math.max(m, c.sort), -1);
      const [col] = await addBoardColumns([{ boardId, name, sort: last + 1 }]);
      setBoardColumns((p) => [...p, col]);
    },
    [boardColumns],
  );
  const renameColumn = useCallback(async (id: string, name: string) => {
    await updateBoardColumn(id, { name });
    setBoardColumns((p) => p.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);
  /** Puts column [id] at [index] among its board's columns (renumbering them all). */
  const placeColumn = useCallback(
    async (id: string, index: number) => {
      const col = boardColumns.find((c) => c.id === id);
      if (!col) return;
      const cols = boardColumns.filter((c) => c.boardId === col.boardId).sort((a, b) => a.sort - b.sort);
      const from = cols.findIndex((c) => c.id === id);
      const to = Math.max(0, Math.min(index, cols.length - 1));
      if (from === to) return;
      const order = [...cols];
      order.splice(to, 0, ...order.splice(from, 1));
      // Renumber the whole board so equal or gapped sorts can't block the move.
      const changes = order.map((c, k) => ({ id: c.id, sort: k })).filter((u, k) => order[k].sort !== u.sort);
      // Optimistic: the column stays where it was dropped while the writes go out.
      setBoardColumns((p) =>
        p.map((c) => {
          const u = changes.find((x) => x.id === c.id);
          return u ? { ...c, sort: u.sort } : c;
        }),
      );
      try {
        await Promise.all(changes.map((u) => updateBoardColumn(u.id, { sort: u.sort })));
      } catch (err) {
        // Put the board back the way the database has it, then let the caller say so.
        setBoardColumns(await listBoardColumns().catch(() => boardColumns));
        throw err;
      }
    },
    [boardColumns],
  );
  const moveColumn = useCallback(
    async (id: string, dir: -1 | 1) => {
      const col = boardColumns.find((c) => c.id === id);
      if (!col) return;
      const cols = boardColumns.filter((c) => c.boardId === col.boardId).sort((a, b) => a.sort - b.sort);
      const i = cols.findIndex((c) => c.id === id);
      if (i + dir < 0 || i + dir >= cols.length) return;
      await placeColumn(id, i + dir);
    },
    [boardColumns, placeColumn],
  );
  const removeColumn = useCallback(async (id: string) => {
    await deleteBoardColumn(id); // the database removes its tickets too
    setBoardColumns((p) => p.filter((c) => c.id !== id));
    setTickets((p) => p.filter((t) => t.columnId !== id));
  }, []);

  const createTicket = useCallback(
    async (columnId: string, fields: Partial<TicketFields> & { title: string }) => {
      const col = boardColumns.find((c) => c.id === columnId);
      if (!col) throw new Error("That column no longer exists.");
      const inBoard = tickets.filter((t) => t.boardId === col.boardId);
      const lastSort = inBoard.filter((t) => t.columnId === columnId).reduce((m, t) => Math.max(m, t.sort), 0);
      const t = await addTicket({
        boardId: col.boardId,
        columnId,
        number: inBoard.reduce((m, x) => Math.max(m, x.number), 0) + 1,
        title: fields.title,
        description: fields.description ?? "",
        priority: fields.priority ?? "medium",
        dueOn: fields.dueOn ?? null,
        amount: fields.amount ?? null,
        sort: lastSort + SORT_STEP, // new tickets join the bottom of the column
      });
      setTickets((p) => [...p, t]);
      return t;
    },
    [boardColumns, tickets],
  );
  const editTicket = useCallback(async (id: string, patch: Partial<TicketFields>) => {
    await updateTicket(id, patch);
    setTickets((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);
  const placeTicket = useCallback(
    async (id: string, columnId: string, order: string[]) => {
      const i = order.indexOf(id);
      if (i < 0) return;
      const sortOf = new Map(tickets.map((t) => [t.id, t.sort]));
      const between = sortBetween(
        i > 0 ? sortOf.get(order[i - 1]) : undefined,
        i < order.length - 1 ? sortOf.get(order[i + 1]) : undefined,
      );
      // Usually one row changes; when neighbours are too close, renumber the column.
      const moves = between === null ? order.map((tid, k) => ({ id: tid, sort: (k + 1) * SORT_STEP })) : [{ id, sort: between }];
      // Optimistic: the card stays where it was dropped while the write goes out.
      setTickets((p) =>
        p.map((t) => {
          const m = moves.find((x) => x.id === t.id);
          return m ? { ...t, sort: m.sort, columnId: t.id === id ? columnId : t.columnId } : t;
        }),
      );
      try {
        await Promise.all(
          moves.map((m) => updateTicket(m.id, m.id === id ? { sort: m.sort, columnId } : { sort: m.sort })),
        );
      } catch (err) {
        console.warn("[catalyst] could not move the ticket", err);
        // Put the board back the way the database has it.
        setTickets(await listTickets().catch(() => tickets));
      }
    },
    [tickets],
  );
  const removeTicket = useCallback(async (id: string) => {
    await deleteTicket(id);
    setTickets((p) => p.filter((t) => t.id !== id));
  }, []);
  const addTickets = useCallback(
    async (boardId: string, items: { columnId: string; fields: Partial<TicketFields> & { title: string } }[]) => {
      if (!items.length) return [];
      // Numbers continue the board's; each ticket joins the bottom of its column.
      let number = tickets.filter((t) => t.boardId === boardId).reduce((m, t) => Math.max(m, t.number), 0);
      const lastSort = new Map<string, number>();
      for (const t of tickets) {
        if (t.boardId === boardId) lastSort.set(t.columnId, Math.max(lastSort.get(t.columnId) ?? 0, t.sort));
      }
      const rows: NewTicket[] = items.map(({ columnId, fields }) => {
        const sort = (lastSort.get(columnId) ?? 0) + SORT_STEP;
        lastSort.set(columnId, sort);
        return {
          boardId,
          columnId,
          number: ++number,
          title: fields.title,
          description: fields.description ?? "",
          priority: fields.priority ?? "medium",
          dueOn: fields.dueOn ?? null,
          amount: fields.amount ?? null,
          sort,
        };
      });
      const created = await insertTickets(rows);
      setTickets((p) => [...p, ...created]);
      return created;
    },
    [tickets],
  );
  const removeTickets = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    await deleteTicketRows(ids);
    const gone = new Set(ids);
    setTickets((p) => p.filter((t) => !gone.has(t.id)));
  }, []);

  const value = useMemo<AppDataValue>(
    () => ({
      loading,
      categories,
      transactions,
      moods,
      budgets,
      goals,
      bills,
      journal,
      activities,
      activityLogs,
      boards,
      boardColumns,
      tickets,
      wallets,
      transfers,
      debts,
      debtPayments,
      walletsReady,
      recurring,
      challenges,
      recurringReady,
      createRecurring,
      editRecurring,
      pauseRecurring,
      removeRecurring,
      createChallenge,
      removeChallenge,
      lang,
      setLanguage,
      currency,
      setCurrencyCode,
      reminders,
      setReminders,
      toasts,
      pushToast,
      dismissToast,
      entryOpen,
      entryTab,
      entryDate,
      openEntry,
      closeEntry,
      setEntryTab,
      memoOpen,
      openMemo,
      closeMemo,
      listScan,
      openListScan,
      closeListScan,
      selectedBoards,
      selectBoard,
      vaultMode,
      setVaultMode,
      dashboardHidden,
      setDashboardHidden,
      addMoney,
      editMoney,
      removeMoney,
      saveMood,
      moodsForDate,
      avgMoodForDate,
      createCategory,
      editCategory,
      removeCategory,
      createBudget,
      editBudget,
      removeBudget,
      createGoal,
      editGoal,
      removeGoal,
      createBill,
      editBill,
      removeBill,
      payBill,
      undoBillPayment,
      unpayBill,
      createWallet,
      editWallet,
      removeWallet,
      createTransfer,
      removeTransfer,
      createDebt,
      editDebt,
      removeDebt,
      recordDebtPayment,
      removeDebtPayment,
      createJournal,
      removeJournal,
      createActivity,
      removeActivity,
      toggleActivity,
      createBoard,
      renameBoard,
      removeBoard,
      createColumn,
      renameColumn,
      moveColumn,
      placeColumn,
      removeColumn,
      createTicket,
      editTicket,
      placeTicket,
      removeTicket,
      addTickets,
      removeTickets,
    }),
    [
      loading, categories, transactions, moods, budgets, goals, bills, journal, activities,
      activityLogs, boards, boardColumns, tickets, entryOpen, entryTab, entryDate, openEntry, closeEntry, memoOpen,
      openMemo, closeMemo, listScan, openListScan, closeListScan, selectedBoards, selectBoard, vaultMode, setVaultMode,
      dashboardHidden, setDashboardHidden, addMoney, editMoney, removeMoney,
      saveMood, moodsForDate, avgMoodForDate, createCategory, editCategory, removeCategory, createBudget, editBudget,
      removeBudget, createGoal, editGoal, removeGoal, createBill, editBill, removeBill, createJournal,
      removeJournal, createActivity, removeActivity, toggleActivity, createBoard, renameBoard, removeBoard,
      createColumn, renameColumn, moveColumn, placeColumn, removeColumn, createTicket, editTicket, placeTicket, removeTicket,
      addTickets, removeTickets, wallets, transfers, debts, debtPayments, walletsReady, lang, setLanguage, currency, setCurrencyCode,
      reminders, setReminders, toasts, pushToast, dismissToast, payBill, undoBillPayment, unpayBill, createWallet,
      editWallet, removeWallet, createTransfer, removeTransfer, createDebt, editDebt, removeDebt, recordDebtPayment,
      removeDebtPayment, recurring, challenges, recurringReady, createRecurring, editRecurring, pauseRecurring,
      removeRecurring, createChallenge, removeChallenge,
    ],
  );

  // A language switch re-renders everything: the text comes from tr().
  return (
    <Ctx.Provider value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export function useAppData(): AppDataValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
