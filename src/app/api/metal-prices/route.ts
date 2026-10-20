// Today's international gold and silver prices for the zakat calculator, per gram
// in the account's currency: spot prices in US dollars per troy ounce
// (gold-api.com) times the dollar's exchange rate (open.er-api.com). Both are
// public and need no key; the server caches them (prices for an hour, rates for
// half a day) and so does the CDN, so a busy day is still only a few requests.
// The web and the Android app both call it.
//
//   GET /api/metal-prices?currency=BDT
//   -> { currency, gold, silver, updatedAt, ratesAt }   (gold = 24K, per gram)
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const TROY_OUNCE_G = 31.1034768;
const json = (status: number, body: unknown, cache = false) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": cache ? "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" : "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });

async function spot(symbol: "XAU" | "XAG"): Promise<{ price: number; updatedAt: string }> {
  const res = await fetch(`https://api.gold-api.com/price/${symbol}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${symbol} ${res.status}`);
  const d = (await res.json()) as { price?: unknown; updatedAt?: unknown };
  const price = Number(d.price);
  if (!(price > 0)) throw new Error(`${symbol} price missing`);
  return { price, updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date().toISOString() };
}

async function rate(currency: string): Promise<{ rate: number; at: string }> {
  if (currency === "USD") return { rate: 1, at: new Date().toISOString() };
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 43_200 }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`rates ${res.status}`);
  const d = (await res.json()) as { rates?: Record<string, unknown>; time_last_update_unix?: unknown };
  const r = Number(d.rates?.[currency]);
  if (!(r > 0)) throw new Error(`no rate for ${currency}`);
  const unix = Number(d.time_last_update_unix);
  return { rate: r, at: unix > 0 ? new Date(unix * 1000).toISOString() : new Date().toISOString() };
}

export async function GET(request: NextRequest) {
  const currency = (request.nextUrl.searchParams.get("currency") ?? "BDT").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return json(400, { error: "Unknown currency." });
  try {
    const [gold, silver, fx] = await Promise.all([spot("XAU"), spot("XAG"), rate(currency)]);
    const perGram = (usdPerOunce: number) => Math.round(((usdPerOunce * fx.rate) / TROY_OUNCE_G) * 100) / 100;
    return json(
      200,
      {
        currency,
        gold: perGram(gold.price),
        silver: perGram(silver.price),
        updatedAt: gold.updatedAt > silver.updatedAt ? gold.updatedAt : silver.updatedAt,
        ratesAt: fx.at,
        source: "gold-api.com, open.er-api.com",
      },
      true,
    );
  } catch (err) {
    console.error("[metal-prices]", (err as Error).message);
    return json(503, { error: "Live prices aren't available right now." });
  }
}
