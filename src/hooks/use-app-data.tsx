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
  Board,
  BoardColumn,
  BoardKind,
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
  NewTicket,
  NewTransaction,
  Ticket,
  Transaction,
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
import { loadPrefs, savePrefs } from "@/lib/db/prefs";
import { parseHiddenSections, type DashboardSectionId } from "@/lib/dashboard-sections";
import { SORT_STEP, sortBetween } from "@/lib/boards";
import { toDateKey } from "@/lib/utils";

export type EntryTab = "money" | "mood" | "saving";

/** Ticket fields the editor can change (column moves go through placeTicket). */
export type TicketFields = Pick<Ticket, "title" | "description" | "priority" | "dueOn" | "amount">;

// Key for the hidden dashboard sections, both in localStorage and user metadata.
const DASHBOARD_HIDDEN = "dashboardHidden";

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

  // money / mood
  addMoney: (t: NewTransaction) => Promise<void>;
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
      const [cats, txs, mds, bgs, gls, bls, jnl, acts, alogs, brds, bcols, tks] = await Promise.all([
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

  const addMoney = useCallback(async (t: NewTransaction) => {
    const c = await addTransaction(t);
    setTransactions((p) => [c, ...p].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)));
  }, []);
  const editMoney = useCallback(async (id: string, t: NewTransaction) => {
    const c = await updateTransaction(id, t);
    // Same order as the database list: newest day first, then newest added.
    setTransactions((p) =>
      p
        .map((x) => (x.id === id ? c : x))
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)),
    );
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
      addTickets, removeTickets,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
