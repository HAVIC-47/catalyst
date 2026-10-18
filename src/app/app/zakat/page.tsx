"use client";

// Zakat calculator: what you own (wallets, cash elsewhere, gold, silver, money owed
// to you, investments) less what you owe now, against the nisab — 2.5% when it's
// at or above it. The figures are kept in the account's preferences, so the
// Android app shows the same ones; the maths is lib/zakat.ts (shared with it).
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, HandHeart, Info } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { loadPrefs, savePrefs } from "@/lib/db/prefs";
import { debtIsOpen, debtRemaining, walletBalances } from "@/lib/money";
import { DEFAULT_ZAKAT, nisabWeight, parseZakat, zakatOf, type ZakatInputs } from "@/lib/zakat";
import { cn, combineDateTime, currencySymbol, formatCurrency, nowTime, toDateKey } from "@/lib/utils";
import { tr, digits } from "@/lib/i18n";

const field =
  "min-h-[44px] w-full rounded-xl border border-line bg-ink/[0.02] px-3 font-mono text-sm text-ink outline-hidden focus:border-amber/50";

export default function ZakatPage() {
  const { wallets, transactions, transfers, debts, debtPayments, walletsReady, categories, addMoney, pushToast, removeMoney } = useAppData();
  const [z, setZ] = useState<ZakatInputs>(DEFAULT_ZAKAT);
  const touched = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // This browser's copy first, then the account's (shared with the app).
  useEffect(() => {
    try {
      const local = localStorage.getItem("zakat");
      if (local) setZ(parseZakat(JSON.parse(local)));
    } catch {
      /* ignore */
    }
    loadPrefs()
      .then((meta) => {
        if (!touched.current && meta.zakat) setZ(parseZakat(meta.zakat));
      })
      .catch(() => {
        /* the copy here still works */
      });
  }, []);

  const set = (patch: Partial<ZakatInputs>) => {
    touched.current = true;
    setZ((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem("zakat", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        savePrefs({ zakat: next }).catch((err) => console.warn("[catalyst] could not save the zakat figures", err));
      }, 800);
      return next;
    });
  };

  const tracked = useMemo(() => {
    const balances = walletBalances(wallets, transactions, transfers, debts, debtPayments);
    const open = debts.filter((d) => debtIsOpen(d, debtPayments));
    return {
      wallets: walletsReady ? [...balances.values()].reduce((s, b) => s + b, 0) : 0,
      owedToYou: open.filter((d) => d.direction === "lent").reduce((s, d) => s + debtRemaining(d, debtPayments), 0),
      youOwe: open.filter((d) => d.direction === "borrowed").reduce((s, d) => s + debtRemaining(d, debtPayments), 0),
    };
  }, [wallets, transactions, transfers, debts, debtPayments, walletsReady]);
  const result = zakatOf(z, tracked);
  const unit = z.unit === "g" ? tr("g") : tr("bhori");
  const weight = nisabWeight(z.basis, z.unit);

  const logPaid = async () => {
    if (result.due <= 0) return;
    if (!window.confirm(tr("Add {amount} to your ledger as zakat paid?", { amount: formatCurrency(result.due) }))) return;
    const cat =
      categories.find((c) => c.kind === "expense" && /zakat|যাকাত|জাকাত/i.test(c.name)) ??
      categories.find((c) => c.kind === "expense" && /charity|donation|sadaqa/i.test(c.name)) ??
      categories.find((c) => c.kind === "expense" && c.name === "Other");
    const today = toDateKey(new Date());
    const t = await addMoney({
      kind: "expense",
      amount: result.due,
      categoryId: cat?.id ?? null,
      categoryName: cat?.name ?? "Other",
      place: "",
      note: tr("Zakat"),
      occurredOn: today,
      occurredAt: combineDateTime(today, nowTime()),
    });
    pushToast({ message: tr("Zakat of {amount} added to the ledger.", { amount: formatCurrency(result.due) }), action: { label: tr("Undo"), run: () => removeMoney(t.id) } });
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">{tr("Zakat")}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {tr("Zakat,")}{" "}<span className="serif-italic text-amber/90">{tr("worked out.")}</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink/45">
          {tr("2.5% of what you've held for a lunar year, once it's at least the nisab. Your wallets and Dhar come in by themselves; add gold, silver and anything else.")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <section className="card space-y-4 p-5" aria-label={tr("What you have")}>
            <h2 className="font-display text-xl font-semibold text-ink">
              {tr("What you")} <span className="serif-italic text-amber/90">{tr("have")}</span>
            </h2>
            {walletsReady && (
              <Toggle
                on={z.useWallets}
                onChange={(v) => set({ useWallets: v })}
                label={tr("Your wallets")}
                hint={tr("Everything in Cash, bKash, Nagad, the bank…: {amount}", { amount: formatCurrency(tracked.wallets) })}
              />
            )}
            <Toggle
              on={z.useDhar}
              onChange={(v) => set({ useDhar: v })}
              label={tr("Dhar")}
              hint={tr("Owed to you {owed} (counted) · you owe {owe} (taken off)", { owed: formatCurrency(tracked.owedToYou), owe: formatCurrency(tracked.youOwe) })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Money label={tr("Cash or savings not in a wallet")} value={z.cash} onChange={(n) => set({ cash: n })} />
              <Money label={tr("Investments, shares, business stock")} value={z.investments} onChange={(n) => set({ investments: n })} />
              <Money label={tr("Anything else")} value={z.other} onChange={(n) => set({ other: n })} />
              <Money label={tr("Debts due now (not in Dhar)")} value={z.debts} onChange={(n) => set({ debts: n })} hint={tr("Taken off")} />
            </div>
          </section>

          <section className="card space-y-4 p-5" aria-label={tr("Gold and silver")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">
                {tr("Gold")} <span className="serif-italic text-amber/90">{tr("& silver")}</span>
              </h2>
              <Segmented
                label={tr("Weight in")}
                value={z.unit}
                options={[
                  ["bhori", tr("bhori")],
                  ["g", tr("grams")],
                ]}
                onChange={(v) => set({ unit: v as ZakatInputs["unit"] })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["gold", "silver"] as const).map((metal) => (
                <div key={metal} className="space-y-2 rounded-xl border border-line p-3">
                  <div className="text-sm font-semibold text-ink/80">{metal === "gold" ? tr("Gold") : tr("Silver")}</div>
                  <label className="block">
                    <span className="text-[11px] text-ink/45">{tr("You own ({unit})", { unit })}</span>
                    <NumberInput
                      value={metal === "gold" ? z.gold : z.silver}
                      onChange={(n) => set(metal === "gold" ? { gold: n } : { silver: n })}
                      parse={num}
                      label={metal === "gold" ? tr("Gold you own") : tr("Silver you own")}
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-ink/45">{tr("Today's price per {unit}", { unit })}</span>
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
                      <span className="font-mono text-ink/40">{currencySymbol()}</span>
                      <NumberInput
                        value={metal === "gold" ? z.goldPrice : z.silverPrice}
                        onChange={(n) => set(metal === "gold" ? { goldPrice: n } : { silverPrice: n })}
                        parse={num}
                        label={metal === "gold" ? tr("Gold price") : tr("Silver price")}
                      />
                    </div>
                  </label>
                </div>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-ink/40">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {tr("Use today's selling price — in Bangladesh, BAJUS publishes it. 1 bhori = 11.664 g.")}
            </p>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5" aria-label={tr("Nisab")}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">{tr("Nisab")}</h2>
              <Segmented
                label={tr("Nisab by")}
                value={z.basis}
                options={[
                  ["silver", tr("Silver")],
                  ["gold", tr("Gold")],
                ]}
                onChange={(v) => set({ basis: v as ZakatInputs["basis"] })}
              />
            </div>
            <p className="mt-2 text-sm text-ink/55">
              {z.basis === "silver"
                ? tr("{weight} {unit} of silver", { weight: digits(weight.toFixed(z.unit === "g" ? 2 : 1)), unit })
                : tr("{weight} {unit} of gold", { weight: digits(weight.toFixed(z.unit === "g" ? 2 : 1)), unit })}
              {result.nisab > 0 ? ` = ${formatCurrency(result.nisab)}` : ""}
            </p>
            {result.nisab === 0 && (
              <p className="mt-1 text-[11px] text-amber/90">
                {z.basis === "silver" ? tr("Add today's silver price to see it.") : tr("Add today's gold price to see it.")}
              </p>
            )}
            <p className="mt-2 text-[11px] text-ink/40">{tr("Silver gives the lower nisab, so more people pay; many scholars advise it.")}</p>
          </section>

          <section className="card p-5" aria-label={tr("Zakat due")}>
            <dl className="space-y-1.5 font-mono text-[13px]">
              <Row label={tr("What you have")} value={formatCurrency(result.assets)} />
              <Row label={tr("Less what you owe")} value={formatCurrency(-result.liabilities)} />
              <Row label={tr("Counted for zakat")} value={formatCurrency(result.net)} strong />
            </dl>
            <div className="mt-4 rounded-xl bg-amber/10 p-4 text-center">
              <div className="label text-[10px]">{tr("Zakat due (2.5%)")}</div>
              <div className="mt-1 font-display text-4xl font-semibold text-ink">{formatCurrency(result.due)}</div>
              <p className="mt-2 text-xs text-ink/55">
                {result.nisab === 0
                  ? tr("Add the price above to check it against the nisab.")
                  : result.above
                    ? tr("At or above the nisab — due once you've held it for a lunar year.")
                    : tr("Below the nisab — no zakat is due.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logPaid()}
              disabled={result.due <= 0}
              className="entry-btn mt-4 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-paper disabled:opacity-40"
            >
              <HandHeart className="h-4 w-4" aria-hidden /> {tr("Log it as paid")}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-ink/40">{tr("An estimate to help you. For your own situation, ask a scholar.")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

const num = (v: string) => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function Money({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-ink/70">{label}</span>
      {hint && <span className="block text-[11px] text-ink/40">{hint}</span>}
      <div className="mt-1 flex items-center gap-2 rounded-xl border border-line bg-ink/[0.02] px-3 focus-within:border-amber/50">
        <span className="font-mono text-ink/40">{currencySymbol()}</span>
        <NumberInput value={value} onChange={onChange} parse={num} label={label} />
      </div>
    </label>
  );
}

/** A number field that keeps what's typed ("12." stays) and reports the number. */
function NumberInput({ value, onChange, parse, label, className }: { value: number; onChange: (n: number) => void; parse: (v: string) => number; label: string; className?: string }) {
  const [text, setText] = useState(value ? String(value) : "");
  const last = useRef(value);
  useEffect(() => {
    // Figures loaded from the account replace what's shown.
    if (value !== last.current) {
      last.current = value;
      setText(value ? String(value) : "");
    }
  }, [value]);
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder="0"
      aria-label={label}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.]/g, "");
        setText(v);
        const n = parse(v);
        last.current = n;
        onChange(n);
      }}
      className={className ?? "min-h-[44px] w-full bg-transparent font-mono text-sm text-ink outline-hidden"}
    />
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl border border-line px-3 text-left transition-colors hover:bg-ink/[0.03]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink/80">{label}</span>
        <span className="block text-[11px] text-ink/45">{hint}</span>
      </span>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", on ? "border-income bg-income/20 text-income" : "border-line text-transparent")}>
        <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
      </span>
    </button>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-xl border border-line p-0.5" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("min-h-[34px] cursor-pointer rounded-[10px] px-3 text-xs font-semibold", value === v ? "bg-amber/15 text-ink" : "text-ink/50 hover:text-ink")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong ? "border-t border-line pt-1.5 text-ink" : "text-ink/60")}>
      <dt>{label}</dt>
      <dd className={cn("tabular", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}
