// Reminders job: run once an hour (a GitHub Actions schedule calls it with
// CRON_SECRET). For every browser that turned reminders on, at the user's own
// evening check-in hour (their timezone, their setting), it sends one push:
// bills and dhar due tomorrow, overdue bills, and "how was today?" when no mood is
// logged yet. Nothing to say means nothing is sent.
//
// Reads across accounts, so it uses the service-role key — server-only, never
// shipped to a browser — and scopes every query to one user explicitly.
//
//   POST (or GET) with  Authorization: Bearer <CRON_SECRET>
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { currencyOf, type CurrencyInfo } from "@/lib/currency";
import { parseReminders } from "@/lib/reminders";
import { bn } from "@/lib/bn";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  tz: string;
}

const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** "yyyy-mm-dd" and the hour ("21") right now in a timezone. */
function localNow(tz: string): { day: string; hour: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: get("hour") };
  } catch {
    return localNow("Asia/Dhaka");
  }
}

const nextDay = (k: string) => {
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0) || 0;
// The push is written in the user's language (their "lang" preference). Kept to
// this request — the shared tr() follows the browser's choice, not a user's here.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
function say(lang: string, en: string, args: Record<string, string | number> = {}): string {
  let s = lang === "bn" ? (bn[en] ?? en) : en;
  for (const [k, v] of Object.entries(args)) {
    const text = typeof v === "number" && lang === "bn" ? String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : String(v);
    s = s.split(`{${k}}`).join(text);
  }
  return s;
}

const money = (n: number, c: CurrencyInfo) =>
  `${c.symbol}${new Intl.NumberFormat(c.locale, { maximumFractionDigits: n % 1 === 0 ? 0 : c.decimals }).format(Math.abs(n))}`;

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return json(401, { error: "Not allowed." });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!url || !service || !publicKey || !privateKey) {
    return json(503, { error: "Reminders aren't configured (SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)." });
  }
  // Who push services can contact about these messages: an https: or mailto: address.
  const origin = new URL(request.url).origin;
  const subject = process.env.VAPID_SUBJECT || (origin.startsWith("https:") ? origin : "mailto:reminders@catalyst.invalid");
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (err) {
    return json(503, { error: `The reminder keys aren't valid: ${(err as Error).message}` });
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: subs, error } = await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,tz");
  if (error) return json(503, { error: "push_subscriptions unavailable — run db/supabase.sql." });

  // One message per person per timezone (their phone and laptop may differ).
  const groups = new Map<string, SubRow[]>();
  for (const s of (subs ?? []) as SubRow[]) {
    const k = `${s.user_id}|${s.tz || "Asia/Dhaka"}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(s);
  }

  let sent = 0;
  let removed = 0;
  let checked = 0;
  for (const [key, list] of groups) {
    const [userId, tz] = key.split("|");
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const meta = (u?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const prefs = parseReminders(meta.reminders);
    const { day: today, hour } = localNow(tz);
    if (hour !== prefs.checkinTime.slice(0, 2)) continue;
    checked++;
    const tomorrow = nextDay(today);
    const cur = currencyOf(meta.currency);
    const lang = meta.lang === "bn" ? "bn" : "en";
    const amount = (n: number) => (lang === "bn" ? money(n, cur).replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : money(n, cur));
    const lines: string[] = [];

    if (prefs.bills) {
      const { data: bills } = await admin
        .from("bills")
        .select("name,amount,due_on")
        .eq("user_id", userId)
        .eq("is_paid", false)
        .lte("due_on", tomorrow);
      const dueTomorrow = (bills ?? []).filter((b) => b.due_on === tomorrow);
      const overdue = (bills ?? []).filter((b) => b.due_on < today);
      for (const b of dueTomorrow.slice(0, 3)) lines.push(say(lang, "{name} {amount} due tomorrow", { name: b.name, amount: amount(num(b.amount)) }));
      if (overdue.length) lines.push(say(lang, overdue.length === 1 ? "{n} bill overdue" : "{n} bills overdue", { n: overdue.length }));
    }
    if (prefs.dhar) {
      const { data: debts } = await admin
        .from("debts")
        .select("id,person,direction,amount")
        .eq("user_id", userId)
        .eq("closed", false)
        .eq("due_on", tomorrow);
      if (debts?.length) {
        const { data: pays } = await admin
          .from("debt_payments")
          .select("debt_id,amount")
          .eq("user_id", userId)
          .in("debt_id", debts.map((d) => d.id));
        for (const d of debts.slice(0, 3)) {
          const left = num(d.amount) - (pays ?? []).filter((p) => p.debt_id === d.id).reduce((s, p) => s + num(p.amount), 0);
          if (left <= 0) continue;
          lines.push(
            d.direction === "lent"
              ? say(lang, "{person} owes you {amount} tomorrow", { person: d.person, amount: amount(left) })
              : say(lang, "You owe {person} {amount} tomorrow", { person: d.person, amount: amount(left) }),
          );
        }
      }
    }
    let askMood = false;
    if (prefs.checkin) {
      const { count } = await admin.from("mood_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("logged_on", today);
      askMood = (count ?? 0) === 0;
    }
    if (!lines.length && !askMood) continue;

    const payload = JSON.stringify({
      title: askMood ? say(lang, "How was today?") : "Catalyst",
      body: [askMood ? say(lang, "Log your mood.") : null, ...lines].filter(Boolean).join(" · "),
      url: askMood ? "/app?log=mood" : "/app/bills",
      tag: `reminder-${today}`,
    });
    for (const s of list) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3 * 3600 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // Gone for good (the browser unsubscribed or was reset): drop it.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          console.error("[reminders] push failed", status, (err as Error).message);
        }
      }
    }
  }
  return json(200, { subscriptions: subs?.length ?? 0, dueNow: checked, sent, removed });
}

export const POST = run;
export const GET = run;
