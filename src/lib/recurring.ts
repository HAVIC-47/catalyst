// Recurring income and expenses — when each one falls due. Shared by the web, the
// reminders job (src/app/api/cron/reminders) and, as a Dart port, the Android app
// (lib/util/recurring.dart), so every side works out the same dates.
//
// Dates are "yyyy-mm-dd" keys, counted in UTC so no clock change can shift a day.
// A rule remembers the next date it hasn't logged yet (nextOn); everything from
// there up to today is due. No runtime imports, so a plain Node script can test it.

export type RecurringFrequency = "weekly" | "monthly" | "twice_monthly";

/** What decides a rule's dates. */
export interface Schedule {
  frequency: RecurringFrequency;
  every: number; // weeks or months between (1 = every week / month; twice a month ignores it)
  day1: number; // weekly: weekday 1 (Monday) … 7 (Sunday); otherwise a day of the month, 1 … 31
  day2: number | null; // twice a month: the other day
  time: string; // "HH:mm", the rule's local time
  startOn: string; // nothing is logged before this date …
  endOn: string | null; // … or after this one
}

/** A schedule with where it's got to. */
export interface ScheduleState extends Schedule {
  nextOn: string; // the next date not logged yet
  paused: boolean;
}

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const utc = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const keyOf = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const later = (a: string, b: string) => (a > b ? a : b);

export const addDaysKey = (k: string, n: number): string => keyOf(utc(k) + n * DAY);
export const daysBetween = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / DAY);
/** 1 = Monday … 7 = Sunday. */
export const isoWeekday = (k: string): number => new Date(utc(k)).getUTCDay() || 7;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** A day of the month; days past the month's end fall on its last day (31 → 30 April). */
const monthDay = (y: number, m: number, day: number) => `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;

const isKey = (k: unknown): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || lo));

/** The first date on or after `from` the schedule falls on — null once it has ended. */
export function occurrenceOnOrAfter(s: Schedule, from: string): string | null {
  if (!isKey(s.startOn) || !isKey(from)) return null;
  const lo = later(from, s.startOn);
  const every = clamp(s.every, 1, 12);
  let found = "";
  if (s.frequency === "weekly") {
    // The first matching weekday on or after the start, then every `every` weeks.
    const anchor = addDaysKey(s.startOn, (((clamp(s.day1, 1, 7) - isoWeekday(s.startOn)) % 7) + 7) % 7);
    const step = 7 * every;
    found = lo <= anchor ? anchor : addDaysKey(anchor, Math.ceil(daysBetween(anchor, lo) / step) * step);
  } else {
    // Months counted from the start's month (every `every` months, or every month twice).
    const twice = s.frequency === "twice_monthly";
    const step = twice ? 1 : every;
    const [sy, sm] = s.startOn.split("-").map(Number);
    const [ly, lm] = lo.split("-").map(Number);
    const startIndex = sy * 12 + sm - 1;
    const days = (twice && s.day2 ? [s.day1, s.day2] : [s.day1]).map((d) => clamp(d, 1, 31));
    const first = Math.max(0, Math.floor((ly * 12 + lm - 1 - startIndex) / step));
    for (let j = first; !found && j < first + 3; j++) {
      const index = startIndex + j * step;
      const y = Math.floor(index / 12);
      const m = (index % 12) + 1;
      found = days.map((d) => monthDay(y, m, d)).sort().find((k) => k >= lo) ?? "";
    }
  }
  if (!found) return null;
  return s.endOn && found > s.endOn ? null : found;
}

/** The first date after `date`. */
export const occurrenceAfter = (s: Schedule, date: string): string | null => occurrenceOnOrAfter(s, addDaysKey(date, 1));

/** Dates due now, oldest first: from nextOn up to today — today once its time has come. */
export function dueDates(s: ScheduleState, today: string, now: string, limit = 60): string[] {
  if (s.paused) return [];
  const out: string[] = [];
  for (let d = occurrenceOnOrAfter(s, s.nextOn); d && out.length < limit && (d < today || (d === today && s.time <= now)); d = occurrenceAfter(s, d)) {
    out.push(d);
  }
  return out;
}

/** What nextOn becomes once `last` is logged: the date after it, or — when the rule
 *  has ended — the day after its end (a nextOn past endOn means finished). */
export function nextAfterLogged(s: Schedule, last: string): string {
  return occurrenceAfter(s, last) ?? addDaysKey(later(last, s.endOn ?? last), 1);
}

/** nextOn for a new or changed schedule: its first date from `from` on (the start
 *  date for a new rule — earlier dates are logged too — or today after a change). */
export function firstNextOn(s: Schedule, from: string): string {
  return occurrenceOnOrAfter(s, from) ?? addDaysKey(later(from, s.endOn ?? from), 1);
}

/** No more dates to log (its end date has passed). */
export const hasEnded = (s: ScheduleState): boolean => occurrenceOnOrAfter(s, s.nextOn) === null;

/** Whether two schedules give the same dates and time (a change to anything else keeps nextOn). */
export function sameSchedule(a: Schedule, b: Schedule): boolean {
  return (
    a.frequency === b.frequency &&
    a.every === b.every &&
    a.day1 === b.day1 &&
    (a.frequency === "twice_monthly" ? a.day2 === b.day2 : true) &&
    a.time === b.time &&
    a.startOn === b.startOn &&
    a.endOn === b.endOn
  );
}

/** "yyyy-mm-dd" and "HH:mm" right now in a timezone (Asia/Dhaka when it's unknown). */
export function zonedNow(tz: string, at: Date = new Date()): { day: string; time: string } {
  const p = zonedParts(tz, at.getTime());
  return { day: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}` };
}

/** The moment a local date and time happen in a timezone, as an ISO string. */
export function zonedIso(day: string, time: string, tz: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  const offset = (t: number) => {
    const p = zonedParts(tz, t);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(t / 60_000) * 60_000;
  };
  // Twice, so a moment next to a clock change still lands on the right side.
  let t = wall - offset(wall);
  t = wall - offset(t);
  return new Date(t).toISOString();
}

function zonedParts(tz: string, t: number): { y: number; m: number; d: number; h: number; min: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(t));
  } catch {
    if (tz === "Asia/Dhaka") throw new Error("no timezone data");
    return zonedParts("Asia/Dhaka", t);
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, min: get("minute") };
}
