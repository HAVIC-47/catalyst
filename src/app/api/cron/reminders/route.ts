// Reminders job: run once an hour (a GitHub Actions schedule calls it with
// CRON_SECRET). First it logs every recurring income and expense that has come
// due (in each rule's own timezone) — for everyone, browser notifications or not —
// and tells each person's browsers what it added. Then, for every browser that
// turned reminders on, at the user's own evening check-in hour (their timezone,
// their setting), it sends one push: bills and dhar due tomorrow, overdue bills, a
// streak about to end, a challenge's last day, and "how was today?" when no mood
// is logged yet. Nothing to say means nothing is sent. Each kind follows the
// person's Settings → Notifications.
//
// Reads across accounts, so it uses the service-role key — server-only, never
// shipped to a browser — and scopes every query to one user explicitly.
//
//   POST (or GET) with  Authorization: Bearer <CRON_SECRET>
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { currencyOf, type CurrencyInfo } from "@/lib/currency";
import { parseReminders } from "@/lib/reminders";
import { addDaysKey, dueDates, nextAfterLogged, zonedIso, zonedNow, type RecurringFrequency } from "@/lib/recurring";
import { challengeProgress, challengeTitle, loggedDays, streakOf, type ChallengeKind } from "@/lib/habits";
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

interface RuleRow {
  id: string;
  user_id: string;
  name: string;
  kind: "expense" | "income";
  amount: number | string;
  category_id: string | null;
  wallet_id: string | null;
  frequency: RecurringFrequency;
  every: number;
  day1: number;
  day2: number | null;
  at_time: string;
  start_on: string;
  end_on: string | null;
  next_on: string;
  paused: boolean;
  tz: string;
}

type Admin = SupabaseClient;
type Logged = { name: string; kind: "expense" | "income"; amount: number };

/** Log every recurring date that has come due, in each rule's own timezone. One
 *  entry per rule and date (the database's unique pair) — if the web or the app
 *  got there first, the insert is refused and nothing is added twice. */
async function logRecurring(admin: Admin): Promise<{ byUser: Map<string, Logged[]>; error?: string }> {
  const byUser = new Map<string, Logged[]>();
  // Anything due by tomorrow in UTC covers every timezone that's already there.
  const horizon = addDaysKey(new Date().toISOString().slice(0, 10), 1);
  const { data, error } = await admin.from("recurring").select("*").eq("paused", false).lte("next_on", horizon);
  if (error) return { byUser, error: /does not exist|schema cache/i.test(error.message) ? "recurring unavailable — run db/supabase.sql." : error.message };
  const rules = (data ?? []) as RuleRow[];
  const categoryIds = [...new Set(rules.map((r) => r.category_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (categoryIds.length) {
    const { data: cats } = await admin.from("categories").select("id,name").in("id", categoryIds);
    for (const c of cats ?? []) names.set(c.id as string, c.name as string);
  }
  for (const r of rules) {
    const rule = { frequency: r.frequency, every: r.every, day1: r.day1, day2: r.day2, time: r.at_time, startOn: r.start_on, endOn: r.end_on, nextOn: r.next_on, paused: r.paused };
    const { day, time } = zonedNow(r.tz);
    let last: string | null = null;
    for (const date of dueDates(rule, day, time)) {
      const categoryId = r.category_id && names.has(r.category_id) ? r.category_id : null;
      const { error: failed } = await admin.from("transactions").insert({
        user_id: r.user_id,
        kind: r.kind,
        amount: num(r.amount),
        category_id: categoryId,
        category_name: categoryId ? names.get(categoryId) : "Other",
        place: "",
        note: r.name,
        occurred_on: date,
        occurred_at: zonedIso(date, r.at_time, r.tz),
        wallet_id: r.wallet_id, // none = the default wallet
        recurring_id: r.id,
        recurring_on: date,
      });
      if (failed && failed.code !== "23505") {
        console.error("[reminders] could not log a recurring entry", failed.message);
        break;
      }
      if (!failed) (byUser.get(r.user_id) ?? byUser.set(r.user_id, []).get(r.user_id)!).push({ name: r.name, kind: r.kind, amount: num(r.amount) });
      last = date;
    }
    if (last) await admin.from("recurring").update({ next_on: nextAfterLogged(rule, last) }).eq("id", r.id).lt("next_on", nextAfterLogged(rule, last));
  }
  return { byUser };
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

/** Send one push to each of a person's browsers; drop the ones that are gone. */
async function pushTo(admin: Admin, list: SubRow[], payload: string): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;
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
  return { sent, removed };
}

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

  // Recurring entries first — they're logged whether or not anyone gets a push.
  const recurring = await logRecurring(admin);

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
  const meta = new Map<string, Record<string, unknown>>();
  const metaOf = async (userId: string) => {
    if (!meta.has(userId)) {
      const { data: u } = await admin.auth.admin.getUserById(userId);
      meta.set(userId, (u?.user?.user_metadata ?? {}) as Record<string, unknown>);
    }
    return meta.get(userId)!;
  };

  // What the job just logged, to each person's browsers (one push per person).
  let recurringPushed = 0;
  for (const [userId, logged] of recurring.byUser) {
    const list = (subs ?? []).filter((s) => s.user_id === userId) as SubRow[];
    if (!list.length) continue;
    const m = await metaOf(userId);
    if (!parseReminders(m.reminders).recurring) continue;
    const cur = currencyOf(m.currency);
    const lang = m.lang === "bn" ? "bn" : "en";
    const amount = (x: Logged) => {
      const text = `${x.kind === "income" ? "+" : "−"}${money(x.amount, cur)}`;
      return lang === "bn" ? text.replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : text;
    };
    const payload = JSON.stringify({
      title: logged.length === 1 ? say(lang, "Added automatically") : say(lang, "{n} recurring entries added", { n: logged.length }),
      body: logged.slice(0, 4).map((x) => `${x.name} ${amount(x)}`).join(" · "),
      url: "/app/transactions",
      tag: `recurring-${new Date().toISOString().slice(0, 13)}`,
    });
    const r = await pushTo(admin, list, payload);
    sent += r.sent;
    removed += r.removed;
    recurringPushed++;
  }

  for (const [key, list] of groups) {
    const [userId, tz] = key.split("|");
    const { day: today, hour } = localNow(tz);
    const userMeta = await metaOf(userId);
    const prefs = parseReminders(userMeta.reminders);
    if (hour !== prefs.checkinTime.slice(0, 2)) continue;
    checked++;
    const tomorrow = nextDay(today);
    const cur = currencyOf(userMeta.currency);
    const lang = userMeta.lang === "bn" ? "bn" : "en";
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
    if (prefs.streaks || prefs.challenges) {
      // The last year of entries and moods (dates only) for streaks and challenges.
      const since = addDaysKey(today, -400);
      const [{ data: txs }, { data: mds }] = await Promise.all([
        admin.from("transactions").select("kind,amount,occurred_on,category_id,category_name,recurring_id").eq("user_id", userId).gte("occurred_on", since),
        admin.from("mood_logs").select("mood,logged_on").eq("user_id", userId).gte("logged_on", since),
      ]);
      const entries = (txs ?? []).map((t) => ({
        kind: t.kind as "expense" | "income" | "saving",
        amount: num(t.amount),
        occurredOn: t.occurred_on as string,
        categoryId: (t.category_id as string | null) ?? null,
        categoryName: (t.category_name as string) ?? "",
        recurringId: (t.recurring_id as string | null) ?? null,
      }));
      const moodRows = (mds ?? []).map((m) => ({ mood: m.mood as number, loggedOn: m.logged_on as string }));
      if (prefs.streaks) {
        const s = streakOf(loggedDays(entries, moodRows), today);
        if (!s.todayDone && s.current >= 2) lines.push(say(lang, "Keep your {n}-day streak — log something today", { n: s.current }));
      }
      if (prefs.challenges) {
        const { data: list } = await admin.from("challenges").select("kind,target,category_id,category_name,start_on,days").eq("user_id", userId).lte("start_on", today);
        for (const c of list ?? []) {
          const spec = {
            kind: c.kind as ChallengeKind,
            target: num(c.target),
            categoryId: (c.category_id as string | null) ?? null,
            categoryName: (c.category_name as string) ?? "",
            startOn: c.start_on as string,
            days: c.days as number,
          };
          const p = challengeProgress(spec, entries, moodRows, today);
          if (p.status === "active" && p.daysLeft === 1) {
            lines.push(say(lang, "Last day: {title}", { title: challengeTitle(spec, (k, a) => say(lang, k, a), amount) }));
          }
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
    const r = await pushTo(admin, list, payload);
    sent += r.sent;
    removed += r.removed;
  }
  const logged = [...recurring.byUser.values()].reduce((n, l) => n + l.length, 0);
  return json(200, {
    subscriptions: subs?.length ?? 0,
    dueNow: checked,
    sent,
    removed,
    recurringLogged: logged,
    recurringPushed,
    ...(recurring.error ? { recurringError: recurring.error } : {}),
  });
}

export const POST = run;
export const GET = run;
