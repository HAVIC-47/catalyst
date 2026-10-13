// Reads a photo of a memo (receipt) with Gemini and returns its items as JSON for
// the user to review. Nothing is saved here — the client adds the entries the user
// keeps, through the normal (RLS-scoped) insert path.
//
// The Gemini key never leaves the server: the web app calls this with its session
// cookie, the Android app with `Authorization: Bearer <supabase access token>`.
// Every call needs a signed-in user and counts toward a per-user daily limit
// (public.memo_scans, see db/supabase.sql), so the key can't be used freely.
import { NextResponse, type NextRequest } from "next/server";
import { LIMITS } from "@/lib/limits";
import type { ScannedMemo } from "@/lib/memo";
import { geminiJson } from "@/lib/server/gemini";
import { signedIn } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_SCANS = 40;
const MAX_BASE64 = 4_000_000; // ~3 MB image; clients resize to ~1600px first, well under this
const MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

function prompt(categories: string[], today: string) {
  return `You read photos of shop receipts and cash memos, mostly from Bangladesh. They may be printed or handwritten, in English or Bengali (Bengali digits ০-৯ are numbers). Extract the purchase so each item can be logged as a separate expense. Today is ${today}; memos are usually from the last few days, which helps tell similar digits apart in dates.

Rules:
- items: every purchased line. name = short item name in English (translate Bengali; keep brand names). amount = the line total actually charged for that line (quantity x unit price), as a plain number.
- category: ${categories.length ? `the single best match for the item from this list: ${categories.join(", ")}.` : "a one-word spending category such as Food or Groceries."}
- extras: VAT/tax, service charge, delivery, packaging or tips, each with a positive amount. Do not repeat them in items.
- discount: total discount as a positive number, 0 if none.
- total: the grand total payable as printed, 0 if unreadable.
- date: purchase date as YYYY-MM-DD (dates are usually day/month/year), "" if not printed. time: HH:MM 24-hour, "" if not printed.
- merchant: shop name in English letters (transliterate Bengali), "" if unknown.
- Ignore cash given, change returned, subtotals and running totals.
- If the photo is not a receipt or memo, set isReceipt to false and return no items.`;
}

function schema(categories: string[]) {
  const category: Record<string, unknown> = { type: "STRING" };
  if (categories.length) category.enum = categories;
  return {
    type: "OBJECT",
    properties: {
      isReceipt: { type: "BOOLEAN" },
      merchant: { type: "STRING" },
      date: { type: "STRING" },
      time: { type: "STRING" },
      currency: { type: "STRING" },
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { name: { type: "STRING" }, amount: { type: "NUMBER" }, category },
          required: ["name", "amount", "category"],
        },
      },
      extras: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { name: { type: "STRING" }, amount: { type: "NUMBER" } },
          required: ["name", "amount"],
        },
      },
      discount: { type: "NUMBER" },
      total: { type: "NUMBER" },
    },
    required: ["isReceipt", "merchant", "date", "time", "currency", "items", "extras", "discount", "total"],
  };
}

// Never trust model output: clamp every field to what the database accepts.
const money = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e10 ? Math.round(v * 100) / 100 : 0;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function clean(raw: Record<string, unknown>, categories: string[]): ScannedMemo {
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).slice(0, 80) : []);
  const date = text(raw.date, 10);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : "";
  const time = text(raw.time, 5);
  const currency = text(raw.currency, 8);
  return {
    merchant: text(raw.merchant, LIMITS.place),
    date: validDate,
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "",
    currency: /^(bdt|tk\.?|taka|৳)$/i.test(currency) ? "BDT" : /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : "",
    items: list(raw.items)
      .map((i) => ({
        name: text(i?.name, LIMITS.title) || "Item",
        amount: money(i?.amount),
        category: categories.includes(i?.category as string) ? (i.category as string) : "",
      }))
      .filter((i) => i.amount > 0),
    extras: list(raw.extras)
      .map((e) => ({ name: text(e?.name, LIMITS.name) || "Extra", amount: money(e?.amount) }))
      .filter((e) => e.amount > 0),
    discount: money(raw.discount),
    total: money(raw.total),
  };
}

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail(503, "Memo scanning isn't configured on the server (GEMINI_API_KEY).");

  // JSON only: a cross-site form can't send this content type, and a cross-site
  // fetch with it needs a CORS preflight this route never grants.
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415, "Send JSON.");

  const session = await signedIn(request);
  if (!session) return fail(401, "Log in to scan memos.");
  const { supabase } = session;

  let body: { image?: unknown; mimeType?: unknown; categories?: unknown; today?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const image = typeof body.image === "string" ? body.image : "";
  const mimeType = typeof body.mimeType === "string" && MIME.has(body.mimeType) ? body.mimeType : "";
  if (!image || !mimeType) return fail(400, "Send a JPEG, PNG or WebP photo.");
  if (image.length > MAX_BASE64) return fail(413, "That photo is too large — try again with a smaller one.");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return fail(400, "Bad image data.");
  const categories = Array.isArray(body.categories)
    ? [...new Set(body.categories.filter((c): c is string => typeof c === "string").map((c) => c.trim().slice(0, LIMITS.name)))]
        .filter(Boolean)
        .slice(0, 60)
    : [];

  // The user's local date (their phone/browser), else Bangladesh time.
  const today =
    typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

  // Per-user daily limit. Rows can be added but never deleted by the user, so the
  // count can't be reset from the client.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("memo_scans")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (countError) {
    console.error("[scan-memo] memo_scans unavailable", countError.code, countError.message);
    return fail(503, "Memo scanning isn't set up yet — run db/supabase.sql in Supabase.");
  }
  if ((count ?? 0) >= DAILY_SCANS) return fail(429, `You've scanned ${DAILY_SCANS} memos today — try again tomorrow.`);
  const { error: logError } = await supabase.from("memo_scans").insert({});
  if (logError) {
    console.error("[scan-memo] could not record scan", logError.code, logError.message);
    return fail(503, "Memo scanning isn't set up yet — run db/supabase.sql in Supabase.");
  }

  const result = await geminiJson({
    key,
    system: prompt(categories, today),
    parts: [{ inlineData: { mimeType, data: image } }, { text: "Read this memo." }],
    schema: schema(categories),
    tag: "scan-memo",
  });
  if (!result.ok) {
    if (result.reason === "failed") return fail(502, "The memo reader couldn't process this photo. Try another one.");
    return result.reason === "busy"
      ? fail(503, "The memo reader is busy right now — try again in a minute.")
      : fail(502, "The memo reader isn't available. Try again later.");
  }

  const raw = result.json;
  if (raw.isReceipt === false) return fail(422, "That doesn't look like a memo or receipt.");
  const memo = clean(raw, categories);
  if (!memo.items.length && !memo.extras.length) {
    return fail(422, "Couldn't find any items on this memo — try a sharper, closer photo.");
  }
  return NextResponse.json({ memo }, { headers: { "Cache-Control": "no-store" } });
}
