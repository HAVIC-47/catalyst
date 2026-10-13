// Shared shape of a scanned memo (receipt), as returned by /api/scan-memo.
export interface MemoLine {
  name: string;
  amount: number;
  category: string; // one of the category names sent with the scan, or "" if none fit
}

export interface MemoExtra {
  name: string; // VAT, service charge, delivery…
  amount: number;
}

export interface ScannedMemo {
  merchant: string;
  date: string; // yyyy-mm-dd, "" when not printed
  time: string; // HH:mm, "" when not printed
  currency: string; // "BDT", another ISO code, or ""
  items: MemoLine[];
  extras: MemoExtra[];
  discount: number; // positive
  total: number; // grand total printed on the memo, 0 if unreadable
}

/** Discount share for each line, proportional to its amount, rounded so the shares add up exactly. */
export function discountShares(amounts: number[], discount: number): number[] {
  const sum = amounts.reduce((s, a) => s + a, 0);
  if (!(discount > 0) || !(sum > discount)) return amounts.map(() => 0);
  const shares = amounts.map((a) => Math.round(((discount * a) / sum) * 100) / 100);
  const drift = Math.round((discount - shares.reduce((s, x) => s + x, 0)) * 100) / 100;
  if (drift) {
    const biggest = amounts.indexOf(Math.max(...amounts));
    shares[biggest] = Math.round((shares[biggest] + drift) * 100) / 100;
  }
  return shares;
}
