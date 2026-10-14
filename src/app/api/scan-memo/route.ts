// Reads a photo with Gemini and returns what it found as JSON for the user to
// review: a memo (receipt) — each item becomes an expense — or, for clients that
// send `notes: true`, a note listing expenses and income (a Notepad or notes-app
// screenshot, a handwritten list, a chat…). Nothing is saved here — the client
// adds the entries the user keeps, through the normal (RLS-scoped) insert path.
// Older clients (the 1.1.0 Android app) don't send `notes`, and keep getting the
// receipt-only reader they were built for.
//
// The Gemini key never leaves the server: the web app calls this with its session
// cookie, the Android app with `Authorization: Bearer <supabase access token>`.
// Every call needs a signed-in user and counts toward a per-user daily limit
// (public.memo_scans, see db/supabase.sql), so the key can't be used freely.
import { NextResponse, type NextRequest } from "next/server";
import { LIMITS } from "@/lib/limits";
import type { ScannedMemo, ScannedNotes } from "@/lib/memo";
import { geminiJson } from "@/lib/server/gemini";
import { countScan, localToday, readImage } from "@/lib/server/scan";
import { signedIn } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

const RECEIPT_RULES = `- items: every purchased line. name = short item name in English (translate Bengali; keep brand names). amount = the line total actually charged for that line (quantity x unit price), as a plain number.
- extras: VAT/tax, service charge, delivery, packaging or tips, each with a positive amount. Do not repeat them in items.
- discount: total discount as a positive number, 0 if none.
- total: the grand total payable as printed, 0 if unreadable.
- date: purchase date as YYYY-MM-DD (dates are usually day/month/year), "" if not printed. time: HH:MM 24-hour, "" if not printed.
- merchant: shop name in English letters (transliterate Bengali), "" if unknown.
- Ignore cash given, change returned, subtotals and running totals.`;

function prompt(categories: string[], today: string) {
  return `You read photos of shop receipts and cash memos, mostly from Bangladesh. They may be printed or handwritten, in English or Bengali (Bengali digits ০-৯ are numbers). Extract the purchase so each item can be logged as a separate expense. Today is ${today}; memos are usually from the last few days, which helps tell similar digits apart in dates.

Rules:
${RECEIPT_RULES}
- category: ${categories.length ? `the single best match for the item from this list: ${categories.join(", ")}.` : "a one-word spending category such as Food or Groceries."}
- If the photo is not a receipt or memo, set isReceipt to false and return no items.`;
}

/** Receipts and notes: the model decides which the photo is. */
function readerPrompt(expense: string[], income: string[], today: string) {
  return `You read photos and screenshots for a personal money app used mostly in Bangladesh and turn them into entries. Text may be printed, typed or handwritten, in English or Bengali (Bengali digits ০-৯ are numbers). Today is ${today}.

First decide what the image is (kind):
- "receipt": a shop receipt, bill or cash memo for one purchase.
- "notes": the person's own record of their money — a notes app or Notepad screenshot, a handwritten list, a chat message or a spreadsheet — listing expenses and/or income.
- "other": anything else.

For a receipt, fill merchant, date, time, currency, items, extras, discount and total, and leave entries empty. Receipts are usually from the last few days, which helps tell similar digits apart in dates.
${RECEIPT_RULES}
- item category: the single best match for the item from the expense categories below.

For notes, fill entries (and date, if the whole note has one date) and leave items and extras empty.
- One entry per money line, in order. Skip headings, totals, balances and running sums.
- type: "income" for money received (salary, payment received, a gift received, a refund, a "+" amount); "expense" for money spent — the default when unclear.
- amount: the line's amount as a plain positive number. Ignore "tk", "৳" and other currency marks.
- name: a short description in English (translate Bengali), e.g. "Lunch" or "Rickshaw to office".
- category: if the note labels the line or its section with a category (e.g. "Food: lunch 250", or a "Transport" heading), use that label — but when it means the same as one of the categories below for that type, use that category's exact spelling. If the note doesn't label it, choose the best category below for its type. Never invent a category the note doesn't name.
- date: YYYY-MM-DD when the line or its section has a date (usually day/month; this year unless a year is written), else "".

Expense categories: ${expense.join(", ") || "none yet"}.
Income categories: ${income.join(", ") || "none yet"}.`;
}

const RECEIPT_PROPERTIES = {
  merchant: { type: "STRING" },
  date: { type: "STRING" },
  time: { type: "STRING" },
  currency: { type: "STRING" },
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
};
const RECEIPT_REQUIRED = ["merchant", "date", "time", "currency", "items", "extras", "discount", "total"];
const itemsOf = (category: Record<string, unknown>) => ({
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { name: { type: "STRING" }, amount: { type: "NUMBER" }, category },
    required: ["name", "amount", "category"],
  },
});

function schema(categories: string[]) {
  const category: Record<string, unknown> = { type: "STRING" };
  if (categories.length) category.enum = categories;
  return {
    type: "OBJECT",
    properties: { isReceipt: { type: "BOOLEAN" }, ...RECEIPT_PROPERTIES, items: itemsOf(category) },
    required: ["isReceipt", ...RECEIPT_REQUIRED],
  };
}

function readerSchema() {
  return {
    type: "OBJECT",
    properties: {
      kind: { type: "STRING", enum: ["receipt", "notes", "other"] },
      ...RECEIPT_PROPERTIES,
      items: itemsOf({ type: "STRING" }),
      entries: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", enum: ["expense", "income"] },
            name: { type: "STRING" },
            amount: { type: "NUMBER" },
            category: { type: "STRING" },
            date: { type: "STRING" },
          },
          required: ["type", "name", "amount", "category", "date"],
        },
      },
    },
    required: ["kind", ...RECEIPT_REQUIRED, "entries"],
  };
}

// Never trust model output: clamp every field to what the database accepts.
const money = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e10 ? Math.round(v * 100) / 100 : 0;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown, max: number) => (Array.isArray(v) ? (v as Record<string, unknown>[]).slice(0, max) : []);
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

function clean(raw: Record<string, unknown>, categories: string[]): ScannedMemo {
  const date = text(raw.date, 10);
  const time = text(raw.time, 5);
  const currency = text(raw.currency, 8);
  return {
    merchant: text(raw.merchant, LIMITS.place),
    date: isDate(date) ? date : "",
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "",
    currency: /^(bdt|tk\.?|taka|৳)$/i.test(currency) ? "BDT" : /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : "",
    items: list(raw.items, 80)
      .map((i) => ({
        name: text(i?.name, LIMITS.title) || "Item",
        amount: money(i?.amount),
        category: categories.includes(i?.category as string) ? (i.category as string) : "",
      }))
      .filter((i) => i.amount > 0),
    extras: list(raw.extras, 80)
      .map((e) => ({ name: text(e?.name, LIMITS.name) || "Extra", amount: money(e?.amount) }))
      .filter((e) => e.amount > 0),
    discount: money(raw.discount),
    total: money(raw.total),
  };
}

function cleanNotes(raw: Record<string, unknown>, expense: string[], income: string[], today: string): ScannedNotes {
  // A date after today is a misread; leave it blank so the client uses its default.
  const day = (v: unknown) => {
    const d = text(v, 10);
    return isDate(d) && d <= today ? d : "";
  };
  return {
    date: day(raw.date),
    entries: list(raw.entries, 100)
      .map((e) => {
        const type: "expense" | "income" = e?.type === "income" ? "income" : "expense";
        const names = type === "income" ? income : expense;
        const find = (n: string) => names.find((x) => x.toLowerCase() === n.toLowerCase());
        const label = text(e?.category, LIMITS.name);
        // The user's own spelling when it exists; a label from the note becomes a new category.
        const category = find(label) ?? (label ? label.charAt(0).toUpperCase() + label.slice(1) : (find("Other") ?? "Other"));
        return {
          type,
          name: text(e?.name, LIMITS.title) || category,
          amount: money(e?.amount),
          category,
          newCategory: !find(category),
          date: day(e?.date),
        };
      })
      .filter((e) => e.amount > 0),
  };
}

const names = (v: unknown) =>
  Array.isArray(v)
    ? [...new Set(v.filter((c): c is string => typeof c === "string").map((c) => c.trim().slice(0, LIMITS.name)))]
        .filter(Boolean)
        .slice(0, 60)
    : [];

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail(503, "Memo scanning isn't configured on the server (GEMINI_API_KEY).");

  // JSON only: a cross-site form can't send this content type, and a cross-site
  // fetch with it needs a CORS preflight this route never grants.
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415, "Send JSON.");

  const session = await signedIn(request);
  if (!session) return fail(401, "Log in to scan memos.");
  const { supabase } = session;

  let body: {
    image?: unknown;
    mimeType?: unknown;
    categories?: unknown;
    incomeCategories?: unknown;
    notes?: unknown;
    today?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const photo = readImage(body);
  if ("error" in photo) return fail(photo.status, photo.error);
  const categories = names(body.categories); // expense categories
  const incomeCategories = names(body.incomeCategories);
  const withNotes = body.notes === true;
  const today = localToday(body.today);

  const limited = await countScan(supabase, "scan-memo");
  if (limited) return fail(limited.status, limited.error);

  const result = await geminiJson({
    key,
    system: withNotes ? readerPrompt(categories, incomeCategories, today) : prompt(categories, today),
    parts: [{ inlineData: { mimeType: photo.mimeType, data: photo.image } }, { text: withNotes ? "Read this image." : "Read this memo." }],
    schema: withNotes ? readerSchema() : schema(categories),
    tag: "scan-memo",
  });
  if (!result.ok) {
    if (result.reason === "failed") return fail(502, "The memo reader couldn't process this photo. Try another one.");
    return result.reason === "busy"
      ? fail(503, "The memo reader is busy right now — try again in a minute.")
      : fail(502, "The memo reader isn't available. Try again later.");
  }

  const raw = result.json;
  if (withNotes && raw.kind === "notes") {
    const notes = cleanNotes(raw, categories, incomeCategories, today);
    if (!notes.entries.length) {
      return fail(422, "Couldn't find any expenses or income in this note — try a sharper screenshot.");
    }
    return NextResponse.json({ notes }, { headers: { "Cache-Control": "no-store" } });
  }
  if (withNotes ? raw.kind !== "receipt" : raw.isReceipt === false) {
    return fail(
      422,
      withNotes
        ? "That doesn't look like a memo, a receipt or a note of expenses and income."
        : "That doesn't look like a memo or receipt.",
    );
  }
  const memo = clean(raw, categories);
  if (!memo.items.length && !memo.extras.length) {
    return fail(422, "Couldn't find any items on this memo — try a sharper, closer photo.");
  }
  return NextResponse.json({ memo }, { headers: { "Cache-Control": "no-store" } });
}
