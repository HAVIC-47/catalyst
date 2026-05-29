"use client";

// Central client store for the authenticated app.
import {
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
  Budget,
  Category,
  Goal,
  JournalEntry,
  MoodLog,
  NewActivity,
  NewBill,
  NewBudget,
  NewCategory,
  NewGoal,
  NewJournalEntry,
  NewMoodLog,
  NewTransaction,
  Transaction,
} from "@/types";
import { BREAK_SAVING } from "@/types";
import {
  addCategory,
  deleteCategory,
  listCategories,
  seedDefaultCategories,
  updateCategory,
} from "@/lib/db/categories";
import { addTransaction, deleteTransaction, listTransactions } from "@/lib/db/transactions";
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
import { toDateKey } from "@/lib/utils";

export type EntryTab = "money" | "mood" | "saving";

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

  // entry modal
  entryOpen: boolean;
  entryTab: EntryTab;
  entryDate: string;
  openEntry: (opts?: { tab?: EntryTab; date?: string }) => void;
  closeEntry: () => void;
  setEntryTab: (t: EntryTab) => void;

  // money / mood
  addMoney: (t: NewTransaction) => Promise<void>;
  removeMoney: (id: string) => Promise<void>;
  saveMood: (m: NewMoodLog) => Promise<void>;
  moodsForDate: (k: string) => MoodLog[];
  avgMoodForDate: (k: string) => number | null;

  // categories
  createCategory: (c: NewCategory) => Promise<void>;
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

  // journal
  createJournal: (j: NewJournalEntry) => Promise<void>;
  removeJournal: (id: string) => Promise<void>;

  // activities
  createActivity: (a: NewActivity) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;
  toggleActivity: (activityId: string, dateKey: string) => Promise<void>;
}

const Ctx = createContext<AppDataValue | null>(null);

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

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryTab, setEntryTab] = useState<EntryTab>("money");
  const [entryDate, setEntryDate] = useState<string>(toDateKey(new Date()));

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
      const [cats, txs, mds, bgs, gls, bls, jnl, acts, alogs] = await Promise.all([
        safe(listCategories, [] as Category[], "categories"),
        safe(listTransactions, [] as Transaction[], "transactions"),
        safe(listMoods, [] as MoodLog[], "moods"),
        safe(listBudgets, [] as Budget[], "budgets"),
        safe(listGoals, [] as Goal[], "goals"),
        safe(listBills, [] as Bill[], "bills"),
        safe(listJournal, [] as JournalEntry[], "journal"),
        safe(listActivities, [] as Activity[], "activities"),
        safe(listActivityLogs, [] as ActivityLog[], "activityLogs"),
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
            color: "#34618A",
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
      setLoading(false);
    })();
  }, []);

  const openEntry = useCallback((opts?: { tab?: EntryTab; date?: string }) => {
    if (opts?.tab) setEntryTab(opts.tab);
    setEntryDate(opts?.date ?? toDateKey(new Date()));
    setEntryOpen(true);
  }, []);
  const closeEntry = useCallback(() => setEntryOpen(false), []);

  const addMoney = useCallback(async (t: NewTransaction) => {
    const c = await addTransaction(t);
    setTransactions((p) => [c, ...p].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)));
  }, []);
  const removeMoney = useCallback(async (id: string) => {
    await deleteTransaction(id);
    setTransactions((p) => p.filter((t) => t.id !== id));
  }, []);
  const saveMood = useCallback(async (m: NewMoodLog) => {
    const s = await addMood(m);
    setMoods((p) => [s, ...p].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)));
  }, []);
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
    setCategories((p) => [...p, x]);
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
      entryOpen,
      entryTab,
      entryDate,
      openEntry,
      closeEntry,
      setEntryTab,
      addMoney,
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
      createJournal,
      removeJournal,
      createActivity,
      removeActivity,
      toggleActivity,
    }),
    [
      loading, categories, transactions, moods, budgets, goals, bills, journal, activities,
      activityLogs, entryOpen, entryTab, entryDate, openEntry, closeEntry, addMoney, removeMoney,
      saveMood, moodsForDate, avgMoodForDate, createCategory, editCategory, removeCategory, createBudget, editBudget,
      removeBudget, createGoal, editGoal, removeGoal, createBill, editBill, removeBill, createJournal,
      removeJournal, createActivity, removeActivity, toggleActivity,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
