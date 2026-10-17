"use client";

// Wallets — where the money sits (cash, bKash, Nagad, a bank account…), what's in
// each, and transfers between them. A transfer never counts as spending or
// income; a fee on one (a bKash cash-out, say) is logged as an expense.
import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Archive, ArchiveRestore, ArrowRight, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { WALLET_KINDS, type Wallet, type WalletKind } from "@/types";
import { cn, combineDateTime, currencySymbol, formatCurrency, nowTime, toDateKey, fmt } from "@/lib/utils";
import { defaultWallet, walletBalances } from "@/lib/money";
import { LIMITS } from "@/lib/limits";
import { tr } from "@/lib/i18n";

const COLORS = ["#2E8159", "#E2136E", "#F26522", "#3D80BC", "#7A4E86", "#B59A3C", "#CB453B", "#4C5B82", "#2F6F6B", "#7A746A"];

const field =
  "min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 text-sm text-ink outline-hidden focus:border-amber/50";
const select = "min-h-[44px] w-full cursor-pointer rounded-xl border border-line bg-card px-3 text-sm text-ink/80 outline-hidden focus:border-amber/50";

const message = (err: unknown) =>
  typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : tr("Something went wrong — try again.");

export default function WalletsPage() {
  const { wallets, transactions, transfers, debts, debtPayments, walletsReady, loading } = useAppData();
  const balances = useMemo(
    () => walletBalances(wallets, transactions, transfers, debts, debtPayments),
    [wallets, transactions, transfers, debts, debtPayments],
  );
  const live = wallets.filter((w) => !w.archived);
  const archived = wallets.filter((w) => w.archived);
  const total = live.reduce((s, w) => s + (balances.get(w.id) ?? 0), 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">{tr("Wallets · {n}", { n: live.length })}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {tr("Where it")}{" "}<span className="serif-italic text-amber/90">{tr("sits.")}</span>
        </h1>
        {walletsReady && live.length > 0 && <p className="mt-3 font-mono text-sm text-ink/45">{tr("{amount} across your wallets", { amount: formatCurrency(total) })}</p>}
      </div>

      {!loading && !walletsReady ? (
        <div className="card max-w-xl p-6 text-sm leading-relaxed text-ink/60">
          {tr("Wallets need a database update. In Supabase, open the SQL editor and run")}{" "}<span className="font-mono text-ink/80">db/supabase.sql</span>{" "}
          {tr("and then")}{" "}<span className="font-mono text-ink/80">db/security.sql</span>{" "}{tr("from the web repo — then reload this page.")}
        </div>
      ) : (
        <>
          <ul className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((w) => (
              <WalletCard key={w.id} wallet={w} balance={balances.get(w.id) ?? 0} isDefault={defaultWallet(wallets)?.id === w.id} />
            ))}
            <li>
              <NewWallet />
            </li>
          </ul>

          {live.length >= 2 && <TransferForm />}
          <TransferList />

          {archived.length > 0 && (
            <div className="mt-8">
              <div className="label mb-3">{tr("Archived · {n}", { n: archived.length })}</div>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((w) => (
                  <WalletCard key={w.id} wallet={w} balance={balances.get(w.id) ?? 0} isDefault={false} />
                ))}
              </ul>
            </div>
          )}

          <p className="mt-8 max-w-xl text-xs leading-relaxed text-ink/40">
            {tr("A balance is the wallet's starting amount plus the income and expenses logged in it, its transfers, and money lent or paid back from it. Savings entries stay in your savings pool — to move money into a savings account, use a transfer.")}
          </p>
        </>
      )}
    </div>
  );
}

function WalletCard({ wallet: w, balance, isDefault }: { wallet: Wallet; balance: number; isDefault: boolean }) {
  const { editWallet, removeWallet, transactions, wallets } = useAppData();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const kind = tr(WALLET_KINDS.find((k) => k.value === w.kind)?.label ?? "Wallet");
  const month = toDateKey(new Date()).slice(0, 7);
  // Its own entries, plus (for the default wallet) those without a wallet.
  const known = new Set(wallets.map((x) => x.id));
  const mine = transactions.filter((t) => t.walletId === w.id || (isDefault && (!t.walletId || !known.has(t.walletId))));
  const monthIn = mine.filter((t) => t.kind === "income" && t.occurredOn.startsWith(month)).reduce((s, t) => s + t.amount, 0);
  const monthOut = mine.filter((t) => t.kind === "expense" && t.occurredOn.startsWith(month)).reduce((s, t) => s + t.amount, 0);

  if (editing) return <WalletEditor wallet={w} balance={balance} onDone={() => setEditing(false)} />;

  const run = (p: Promise<unknown>) => {
    setError("");
    p.catch((err) => setError(message(err)));
  };

  return (
    <li className={cn("card flex flex-col gap-3 p-5", w.archived && "opacity-60")} aria-label={tr("{name} wallet", { name: w.name })}>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: w.color }} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{tr(w.name)}</span>
        <span className="label">{isDefault ? tr("{kind} · default", { kind }) : kind}</span>
      </div>
      <div className={cn("font-mono text-3xl font-semibold tabular", balance < 0 ? "text-expense" : "text-ink")}>{formatCurrency(balance)}</div>
      <div className="font-mono text-[11px] text-ink/40">
        {tr("This month:")}{" "}<span className="text-income">{tr("in {amount}", { amount: formatCurrency(monthIn) })}</span> · <span className="text-expense">{tr("out {amount}", { amount: formatCurrency(monthOut) })}</span>
      </div>
      {error && (
        <p className="text-xs text-expense" role="alert">
          {error}
        </p>
      )}
      <div className="mt-auto flex items-center gap-1 border-t border-line pt-3">
        <button
          onClick={() => setEditing(true)}
          className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />{" "}{tr("Edit")}
        </button>
        <button
          onClick={() => run(editWallet(w.id, { archived: !w.archived }))}
          className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          {w.archived ? <ArchiveRestore className="h-3.5 w-3.5" aria-hidden /> : <Archive className="h-3.5 w-3.5" aria-hidden />}
          {w.archived ? tr("Restore") : tr("Archive")}
        </button>
        <button
          onClick={() => {
            if (
              window.confirm(
                tr("Delete the {name} wallet? Its entries move to your default wallet, and its transfers are removed.", { name: w.name }),
              )
            )
              run(removeWallet(w.id));
          }}
          aria-label={tr("Delete {name}", { name: w.name })}
          className="ml-auto cursor-pointer rounded-lg p-1.5 text-ink/30 transition-colors hover:bg-ink/5 hover:text-expense"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr("Color")}>
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={tr("Color {c}", { c })}
          onClick={() => onChange(c)}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110"
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="h-3.5 w-3.5 text-paper" aria-hidden strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

function WalletEditor({ wallet: w, balance, onDone }: { wallet: Wallet; balance: number; onDone: () => void }) {
  const { editWallet } = useAppData();
  const [name, setName] = useState(w.name);
  const [kind, setKind] = useState<WalletKind>(w.kind);
  const [color, setColor] = useState(w.color);
  const [now, setNow] = useState(String(balance));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const value = parseFloat(now);

  const save = async () => {
    if (!name.trim() || Number.isNaN(value) || saving) return;
    setSaving(true);
    setError("");
    try {
      // "Balance now" sets the starting amount so the wallet adds up to it.
      const opening = Math.round((w.openingBalance + (value - balance)) * 100) / 100;
      await editWallet(w.id, { name: name.trim(), kind, color, openingBalance: opening });
      onDone();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  };

  return (
    <li className="card flex flex-col gap-3 p-5" aria-label={tr("Edit {name}", { name: w.name })}>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} aria-label={tr("Wallet name")} className={field} />
      <select value={kind} onChange={(e) => setKind(e.target.value as WalletKind)} aria-label={tr("Kind")} className={select}>
        {WALLET_KINDS.map((k) => (
          <option key={k.value} value={k.value} className="bg-card">
            {tr(k.label)}
          </option>
        ))}
      </select>
      <label className="block">
        <span className="label mb-1.5 block">{tr("Balance now")}</span>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
          <span className="font-mono text-ink/40">{currencySymbol()}</span>
          <input
            inputMode="decimal"
            value={now}
            onChange={(e) => setNow(e.target.value.replace(/[^0-9.-]/g, ""))}
            aria-label={tr("Balance now")}
            className="min-h-[44px] w-full bg-transparent font-mono text-sm text-ink outline-hidden"
          />
        </div>
      </label>
      <ColorPicker value={color} onChange={setColor} />
      {error && (
        <p className="text-xs text-expense" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onDone}
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />{" "}{tr("Cancel")}
        </button>
        <button
          onClick={() => void save()}
          disabled={!name.trim() || Number.isNaN(value) || saving}
          className="entry-btn inline-flex min-h-[40px] cursor-pointer items-center rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
        >
          {tr("Save")}
        </button>
      </div>
    </li>
  );
}

function NewWallet() {
  const { wallets, createWallet } = useAppData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WalletKind>("mobile");
  const [color, setColor] = useState(COLORS[4]);
  const [now, setNow] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-full min-h-[140px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm text-ink/50 transition-colors hover:border-ink/30 hover:text-ink/80"
      >
        <Plus className="h-5 w-5" aria-hidden />
        {tr("Add a wallet")}
      </button>
    );
  }

  const add = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createWallet({
        name: name.trim(),
        kind,
        color,
        openingBalance: Math.round((parseFloat(now) || 0) * 100) / 100,
        sort: wallets.reduce((m, w) => Math.max(m, w.sort), -1) + 1,
        archived: false,
      });
      setOpen(false);
      setName("");
      setNow("");
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card flex flex-col gap-3 p-5" role="group" aria-label={tr("New wallet")}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={tr("Name (e.g. Rocket, DBBL)")}
        maxLength={LIMITS.name}
        aria-label={tr("Wallet name")}
        className={field}
      />
      <select value={kind} onChange={(e) => setKind(e.target.value as WalletKind)} aria-label={tr("Kind")} className={select}>
        {WALLET_KINDS.map((k) => (
          <option key={k.value} value={k.value} className="bg-card">
            {tr(k.label)}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
        <span className="font-mono text-ink/40">{currencySymbol()}</span>
        <input
          inputMode="decimal"
          value={now}
          onChange={(e) => setNow(e.target.value.replace(/[^0-9.-]/g, ""))}
          placeholder={tr("What's in it now")}
          aria-label={tr("Balance now")}
          className="min-h-[44px] w-full bg-transparent font-mono text-sm text-ink outline-hidden"
        />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      {error && (
        <p className="text-xs text-expense" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="min-h-[40px] cursor-pointer rounded-xl px-3 text-sm text-ink/60 transition-colors hover:bg-ink/[0.04] hover:text-ink"
        >
          {tr("Cancel")}
        </button>
        <button
          onClick={() => void add()}
          disabled={!name.trim() || saving}
          className="entry-btn inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />{" "}{tr("Add")}
        </button>
      </div>
    </div>
  );
}

function TransferForm() {
  const { wallets, createTransfer } = useAppData();
  const live = wallets.filter((w) => !w.archived);
  const [from, setFrom] = useState(live[0]?.id ?? "");
  const [to, setTo] = useState(live[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const value = parseFloat(amount);
  const valid = from && to && from !== to && value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const move = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    setDone("");
    try {
      const f = parseFloat(fee);
      await createTransfer(
        {
          fromWallet: from,
          toWallet: to,
          amount: Math.round(value * 100) / 100,
          note: note.trim(),
          occurredOn: date,
          occurredAt: combineDateTime(date, date === toDateKey(new Date()) ? nowTime() : "12:00"),
        },
        f > 0 ? f : undefined,
      );
      setDone(tr("Moved {amount} from {x} to {x2}.", { amount: formatCurrency(value), x: live.find((w) => w.id === from)?.name, x2: live.find((w) => w.id === to)?.name }));
      setAmount("");
      setFee("");
      setNote("");
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card mb-6 p-5" aria-label={tr("Move money")}>
      <h2 className="mb-4 font-display text-2xl font-semibold text-ink">
        {tr("Move")}{" "}<span className="serif-italic text-amber/90">{tr("money.")}</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <label className="block">
          <span className="label mb-1.5 block">{tr("From")}</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={select} aria-label={tr("From wallet")}>
            {live.map((w) => (
              <option key={w.id} value={w.id} className="bg-card">
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <ArrowRight className="mx-auto hidden h-5 w-5 text-ink/30 sm:mb-3 sm:block" aria-hidden />
        <label className="block">
          <span className="label mb-1.5 block">{tr("To")}</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className={select} aria-label={tr("To wallet")}>
            {live.map((w) => (
              <option key={w.id} value={w.id} className="bg-card">
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="label mb-1.5 block">{tr("Amount")}</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={`${currencySymbol()} 0`}
            aria-label={tr("Amount")}
            className={cn(field, "font-mono")}
          />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">{tr("Fee · optional")}</span>
          <input
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={`${currencySymbol()} 0`}
            aria-label={tr("Fee")}
            className={cn(field, "font-mono")}
          />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">{tr("Date")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={tr("Date")} className={field} />
        </label>
        <label className="block">
          <span className="label mb-1.5 block">{tr("Note · optional")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={LIMITS.note} placeholder={tr("Cash out, top-up…")} aria-label={tr("Note")} className={field} />
        </label>
      </div>
      {from === to && <p className="mt-2 text-xs text-expense">{tr("Pick two different wallets.")}</p>}
      {error && (
        <p className="mt-2 text-xs text-expense" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-2 text-xs text-income" role="status">
          {done}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-ink/40">{tr("A fee is added to your ledger as an expense from the first wallet.")}</p>
        <button
          onClick={() => void move()}
          disabled={!valid || saving}
          className="entry-btn inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-paper disabled:opacity-40"
        >
          {tr("Move")}
        </button>
      </div>
    </section>
  );
}

function TransferList() {
  const { transfers, wallets, removeTransfer } = useAppData();
  const name = (id: string) => tr(wallets.find((w) => w.id === id)?.name ?? "Deleted wallet");
  if (!transfers.length) return null;
  return (
    <section className="card overflow-hidden" aria-label={tr("Transfers")}>
      <div className="border-b border-line px-5 py-3">
        <span className="label">{tr("Transfers · {n}", { n: transfers.length })}</span>
      </div>
      <ul className="divide-y divide-line">
        {transfers.slice(0, 30).map((t) => (
          <li key={t.id} className="group flex items-center gap-3 px-5 py-3 text-sm">
            <span className="w-20 shrink-0 font-mono text-[11px] text-ink/40">{fmt(parseISO(t.occurredOn), "MMM d")}</span>
            <span className="min-w-0 flex-1 truncate text-ink/80">
              {name(t.fromWallet)} <ArrowRight className="inline h-3.5 w-3.5 text-ink/30" aria-hidden /> {name(t.toWallet)}
              {t.note && <span className="text-ink/40"> · {t.note}</span>}
            </span>
            <span className="font-mono tabular text-ink/80">{formatCurrency(t.amount)}</span>
            <button
              onClick={() => {
                if (window.confirm(tr("Delete this transfer? Both wallets' balances go back."))) void removeTransfer(t.id);
              }}
              aria-label={tr("Delete transfer")}
              className="cursor-pointer text-ink/0 transition-colors group-hover:text-ink/30 hover:text-expense! focus-visible:text-ink/40"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
