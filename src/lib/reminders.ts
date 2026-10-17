// Reminder settings — kept in the account's preferences (user metadata) so the web,
// the Android app and the server's reminders job all follow the same ones.

export interface ReminderPrefs {
  checkin: boolean; // evening "how was today?"
  checkinTime: string; // HH:mm, the user's local time
  bills: boolean; // the day before a bill is due
  budgets: boolean; // at 80% and 100% of a monthly budget
  dhar: boolean; // the day before money lent or borrowed is due back
}

export const DEFAULT_REMINDERS: ReminderPrefs = { checkin: true, checkinTime: "21:00", bills: true, budgets: true, dhar: true };

/** Stored settings, with defaults for anything missing or malformed. */
export function parseReminders(raw: unknown): ReminderPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (k: "checkin" | "bills" | "budgets" | "dhar") => (typeof r[k] === "boolean" ? (r[k] as boolean) : DEFAULT_REMINDERS[k]);
  const time = typeof r.checkinTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.checkinTime) ? r.checkinTime : DEFAULT_REMINDERS.checkinTime;
  return { checkin: bool("checkin"), checkinTime: time, bills: bool("bills"), budgets: bool("budgets"), dhar: bool("dhar") };
}
