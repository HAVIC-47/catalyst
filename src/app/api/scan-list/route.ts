// Reads a screenshot or photo of a list — a notes app, Notepad, a chat, a to-do
// app, a handwritten list — and returns its items for a to-do or to-buy board.
// Nothing is saved here: the client adds the items through the normal RLS-scoped
// inserts. Same sign-in and daily photo limit as /api/scan-memo.
//
//   POST { image, mimeType, kind: "todo" | "shopping", today }
//   -> { list: { items: [{ title, notes, done, priority, due, price }] } }
import { NextResponse, type NextRequest } from "next/server";
import { LIMITS } from "@/lib/limits";
import type { ListItem } from "@/lib/memo";
import { geminiJson } from "@/lib/server/gemini";
import { countScan, localToday, readImage } from "@/lib/server/scan";
import { signedIn } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

function prompt(shopping: boolean, today: string) {
  return `You read screenshots and photos of lists — phone notes apps, Notepad, chats, to-do apps, handwritten notes — and turn them into ${shopping ? "items for a shopping list" : "tasks for a to-do list"}. Text may be in English or Bengali. Today is ${today}.

Rules:
- One item per line or bullet of the list, in the order they appear. Skip headings, the note's own date, app buttons, the status bar and anything that isn't a list item.
- title: the item as a short phrase in English (translate Bengali; keep names and brands)${shopping ? `. Keep quantities in the title, e.g. "Eggs (12)" or "Rice 5 kg"` : ""}.
- notes: extra detail from the same line that doesn't belong in the title, "" if none.
- done: true when the item is ticked, checked or crossed out.
- priority: "high" when marked urgent, important, ASAP, starred or with "!"; "low" when marked optional or someday; otherwise "medium".
- due: YYYY-MM-DD when the item has a date or a day (e.g. "Friday" is the next Friday after today), else "".
- price: ${shopping ? "the price written for the item as a plain number (ignore tk / ৳), 0 if none" : "always 0"}.
- If the image has no list at all, set isList to false and return no items.`;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    isList: { type: "BOOLEAN" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          notes: { type: "STRING" },
          done: { type: "BOOLEAN" },
          priority: { type: "STRING", enum: ["low", "medium", "high"] },
          due: { type: "STRING" },
          price: { type: "NUMBER" },
        },
        required: ["title", "notes", "done", "priority", "due", "price"],
      },
    },
  },
  required: ["isList", "items"],
};

// Never trust model output: keep only what the tickets table accepts.
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const money = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1e10 ? Math.round(v * 100) / 100 : 0;

function clean(raw: Record<string, unknown>, shopping: boolean): ListItem[] {
  const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]).slice(0, 100) : [];
  return items
    .map((i) => {
      const due = text(i?.due, 10);
      const priority = i?.priority === "high" || i?.priority === "low" ? i.priority : "medium";
      return {
        title: text(i?.title, LIMITS.title),
        notes: text(i?.notes, LIMITS.description),
        done: i?.done === true,
        priority: priority as ListItem["priority"],
        due: /^\d{4}-\d{2}-\d{2}$/.test(due) && !Number.isNaN(Date.parse(due)) ? due : "",
        price: shopping ? money(i?.price) : 0,
      };
    })
    .filter((i) => i.title);
}

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail(503, "Scanning isn't configured on the server (GEMINI_API_KEY).");

  // JSON only: a cross-site form can't send this content type, and a cross-site
  // fetch with it needs a CORS preflight this route never grants.
  if (!request.headers.get("content-type")?.includes("application/json")) return fail(415, "Send JSON.");

  const session = await signedIn(request);
  if (!session) return fail(401, "Log in to scan lists.");

  let body: { image?: unknown; mimeType?: unknown; kind?: unknown; today?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }
  const photo = readImage(body);
  if ("error" in photo) return fail(photo.status, photo.error);
  const shopping = body.kind === "shopping";

  const limited = await countScan(session.supabase, "scan-list");
  if (limited) return fail(limited.status, limited.error);

  const result = await geminiJson({
    key,
    system: prompt(shopping, localToday(body.today)),
    parts: [{ inlineData: { mimeType: photo.mimeType, data: photo.image } }, { text: "Read this list." }],
    schema: SCHEMA,
    tag: "scan-list",
  });
  if (!result.ok) {
    if (result.reason === "failed") return fail(502, "Couldn't read this screenshot. Try another one.");
    return result.reason === "busy"
      ? fail(503, "The reader is busy right now — try again in a minute.")
      : fail(502, "The reader isn't available. Try again later.");
  }
  if (result.json.isList === false) return fail(422, "That doesn't look like a list — try a screenshot of your notes.");
  const items = clean(result.json, shopping);
  if (!items.length) return fail(422, "Couldn't find any items in this screenshot — try a sharper one.");
  return NextResponse.json({ list: { items } }, { headers: { "Cache-Control": "no-store" } });
}
