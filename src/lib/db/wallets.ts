import { createClient } from "@/lib/supabase/client";
import { DEFAULT_WALLETS, type NewTransfer, type NewWallet, type Transfer, type Wallet, type WalletKind } from "@/types";

const num = (v: number | string) => (typeof v === "string" ? parseFloat(v) : v);

interface WalletRow {
  id: string;
  name: string;
  kind: WalletKind;
  color: string;
  opening_balance: number | string;
  sort: number;
  archived: boolean;
}
const toWallet = (r: WalletRow): Wallet => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  color: r.color,
  openingBalance: num(r.opening_balance),
  sort: r.sort,
  archived: r.archived,
});

export async function listWallets(): Promise<Wallet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as WalletRow[]).map(toWallet);
}

export async function addWallet(input: NewWallet): Promise<Wallet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wallets")
    .insert({
      name: input.name,
      kind: input.kind,
      color: input.color,
      opening_balance: input.openingBalance,
      sort: input.sort,
      archived: input.archived,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toWallet(data as WalletRow);
}

/** Cash, bKash, Nagad and Bank, for an account that has no wallets yet. */
export async function seedDefaultWallets(): Promise<Wallet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wallets")
    .insert(DEFAULT_WALLETS.map((w, i) => ({ name: w.name, kind: w.kind, color: w.color, sort: i })))
    .select("*");
  if (error) throw error;
  return (data as WalletRow[]).map(toWallet).sort((a, b) => a.sort - b.sort);
}

export async function updateWallet(id: string, patch: Partial<NewWallet>): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.openingBalance !== undefined) row.opening_balance = patch.openingBalance;
  if (patch.sort !== undefined) row.sort = patch.sort;
  if (patch.archived !== undefined) row.archived = patch.archived;
  const { error } = await supabase.from("wallets").update(row).eq("id", id);
  if (error) throw error;
}

/** Its entries move to the default wallet; its transfers go with it. */
export async function deleteWallet(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("wallets").delete().eq("id", id);
  if (error) throw error;
}

interface TransferRow {
  id: string;
  from_wallet: string;
  to_wallet: string;
  amount: number | string;
  note: string;
  occurred_on: string;
  occurred_at: string;
  created_at: string;
}
const toTransfer = (r: TransferRow): Transfer => ({
  id: r.id,
  fromWallet: r.from_wallet,
  toWallet: r.to_wallet,
  amount: num(r.amount),
  note: r.note,
  occurredOn: r.occurred_on,
  occurredAt: r.occurred_at,
  createdAt: r.created_at,
});

export async function listTransfers(): Promise<Transfer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transfers")
    .select("*")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as TransferRow[]).map(toTransfer);
}

export async function addTransfer(input: NewTransfer): Promise<Transfer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transfers")
    .insert({
      from_wallet: input.fromWallet,
      to_wallet: input.toWallet,
      amount: input.amount,
      note: input.note,
      occurred_on: input.occurredOn,
      occurred_at: input.occurredAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toTransfer(data as TransferRow);
}

export async function deleteTransfer(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("transfers").delete().eq("id", id);
  if (error) throw error;
}
