// Notification settings — kept in the account's preferences (user metadata) so the
// web, the Android app and the server's reminders job all follow the same ones.
// Settings → Notifications turns each kind on or off.

export interface ReminderPrefs {
  checkin: boolean; // evening "how was today?"
  checkinTime: string; // HH:mm, the user's local time
  bills: boolean; // the day before a bill is due
  budgets: boolean; // at 80% and 100% of a monthly budget
  dhar: boolean; // the day before money lent or borrowed is due back
  recurring: boolean; // a recurring income or expense was added
  moodSpend: boolean; // a lot spent on a low-mood day
  streaks: boolean; // streak milestones, and a streak about to end
  challenges: boolean; // a challenge won, lost, or on its last day
  updates: boolean; // a new version of the Android app (set there; kept here)
}

export const DEFAULT_REMINDERS: ReminderPrefs = {
  checkin: true,
  checkinTime: "21:00",
  bills: true,
  budgets: true,
  dhar: true,
  recurring: true,
  moodSpend: true,
  streaks: true,
  challenges: true,
  updates: true,
};

type Flag = Exclude<keyof ReminderPrefs, "checkinTime">;
const FLAGS: Flag[] = ["checkin", "bills", "budgets", "dhar", "recurring", "moodSpend", "streaks", "challenges", "updates"];

/** The kinds Settings → Notifications lists on the web (app updates are set in the app). */
export const WEB_NOTICE_KINDS: Flag[] = ["checkin", "bills", "dhar", "budgets", "recurring", "moodSpend", "streaks", "challenges"];

/** Stored settings, with defaults for anything missing or malformed. */
export function parseReminders(raw: unknown): ReminderPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_REMINDERS };
  for (const k of FLAGS) if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  if (typeof r.checkinTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.checkinTime)) out.checkinTime = r.checkinTime;
  return out;
}
