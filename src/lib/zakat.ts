// Zakat: 2.5% of what you own (cash, gold, silver, savings, money owed to you,
// investments) less what you owe now — when that's at least the nisab, the value
// of 87.48 g of gold or 612.36 g of silver (7.5 or 52.5 bhori). An estimate; the
// page says to ask a scholar. Shared with the Android app (lib/util/zakat.dart);
// the inputs live in the account's preferences, so both show the same figures.

export const NISAB_GOLD_G = 87.48;
export const NISAB_SILVER_G = 612.36;
export const BHORI_G = 11.664;
export const ZAKAT_RATE = 0.025;

export type ZakatBasis = "silver" | "gold";
export type WeightUnit = "g" | "bhori";

export interface ZakatInputs {
  basis: ZakatBasis; // which metal sets the nisab
  unit: WeightUnit; // gold and silver weights and prices are in this unit
  autoPrices: boolean; // today's international prices (else goldPrice / silverPrice)
  goldPrice: number; // per unit, 24K — used when autoPrices is off
  silverPrice: number;
  gold: number; // weight owned
  karat: number; // the gold's purity: 24, 22, 21 or 18
  silver: number;
  cash: number; // cash and accounts not tracked in a wallet
  investments: number; // shares, business stock, other savings
  other: number;
  debts: number; // owed now and not in Dhar
  useWallets: boolean; // count the wallets' balances
  useDhar: boolean; // count Dhar (owed to you, and you owe)
}

export const DEFAULT_ZAKAT: ZakatInputs = {
  basis: "silver",
  unit: "bhori",
  autoPrices: true,
  goldPrice: 0,
  silverPrice: 0,
  gold: 0,
  karat: 22,
  silver: 0,
  cash: 0,
  investments: 0,
  other: 0,
  debts: 0,
  useWallets: true,
  useDhar: true,
};

/** Stored inputs, with defaults for anything missing or malformed. */
export function parseZakat(raw: unknown): ZakatInputs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (k: keyof ZakatInputs) => {
    const v = r[k];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : (DEFAULT_ZAKAT[k] as number);
  };
  const bool = (k: keyof ZakatInputs) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (DEFAULT_ZAKAT[k] as boolean));
  return {
    basis: r.basis === "gold" ? "gold" : "silver",
    unit: r.unit === "g" ? "g" : "bhori",
    autoPrices: bool("autoPrices"),
    goldPrice: num("goldPrice"),
    silverPrice: num("silverPrice"),
    gold: num("gold"),
    karat: KARATS.includes(r.karat as number) ? (r.karat as number) : DEFAULT_ZAKAT.karat,
    silver: num("silver"),
    cash: num("cash"),
    investments: num("investments"),
    other: num("other"),
    debts: num("debts"),
    useWallets: bool("useWallets"),
    useDhar: bool("useDhar"),
  };
}

/** Gold purities the calculator offers (karat / 24 = the share that's gold). */
export const KARATS = [24, 22, 21, 18];

/** Grams in one of a unit. */
export const unitGrams = (unit: WeightUnit): number => (unit === "g" ? 1 : BHORI_G);

/** Today's international prices per gram (24K gold, pure silver), from /api/metal-prices. */
export interface LivePrices {
  gold: number;
  silver: number;
}

/** The prices the sums use, per unit: today's when auto and loaded, else the typed ones. */
export function pricesOf(i: ZakatInputs, live: LivePrices | null): { gold: number; silver: number } {
  if (i.autoPrices && live) {
    const g = unitGrams(i.unit);
    return { gold: Math.round(live.gold * g * 100) / 100, silver: Math.round(live.silver * g * 100) / 100 };
  }
  return { gold: i.goldPrice, silver: i.silverPrice };
}

/** The nisab's weight in a unit. */
export const nisabWeight = (basis: ZakatBasis, unit: WeightUnit): number => {
  const grams = basis === "gold" ? NISAB_GOLD_G : NISAB_SILVER_G;
  return unit === "g" ? grams : grams / BHORI_G;
};

export interface ZakatResult {
  goldValue: number;
  silverValue: number;
  assets: number;
  liabilities: number;
  net: number; // what zakat is counted on (never below zero)
  nisab: number; // 0 until the nisab metal's price is filled in
  above: boolean; // at or over the nisab
  due: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export function zakatOf(i: ZakatInputs, tracked: { wallets: number; owedToYou: number; youOwe: number }, live: LivePrices | null = null): ZakatResult {
  const price = pricesOf(i, live);
  // Only the gold in the jewellery counts: a 22K piece is 22/24 gold.
  const goldValue = cents(i.gold * price.gold * (i.karat / 24));
  const silverValue = cents(i.silver * price.silver);
  const assets = cents(
    (i.useWallets ? tracked.wallets : 0) + i.cash + (i.useDhar ? tracked.owedToYou : 0) + goldValue + silverValue + i.investments + i.other,
  );
  const liabilities = cents((i.useDhar ? tracked.youOwe : 0) + i.debts);
  const net = Math.max(0, cents(assets - liabilities));
  const nisab = cents(nisabWeight(i.basis, i.unit) * (i.basis === "gold" ? price.gold : price.silver));
  const above = nisab > 0 && net >= nisab;
  return { goldValue, silverValue, assets, liabilities, net, nisab, above, due: above ? cents(net * ZAKAT_RATE) : 0 };
}
