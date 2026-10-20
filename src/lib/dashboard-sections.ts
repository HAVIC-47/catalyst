// The dashboard's sections, in display order. Users can hide any of them in
// Settings; hiding only changes what renders — the data behind it is untouched.
export const DASHBOARD_SECTIONS = [
  { id: "kpis", label: "Monthly summary", hint: "Spent · Earned · Saved · Avg mood" },
  { id: "trend", label: "Mood × money trend", hint: "Net flow vs mood over time" },
  { id: "recap", label: "Monthly recap", hint: "AI look back at the month, with what to change" },
  { id: "wallets", label: "Wallets", hint: "What's in cash, bKash, Nagad, the bank" },
  { id: "netWorth", label: "Net worth", hint: "Wallets and dhar, month by month" },
  { id: "habits", label: "Streaks & challenges", hint: "Your streak and the challenges going" },
  { id: "insights", label: "AI insights", hint: "Mood · money · savings, with suggestions" },
  { id: "spent", label: "Spent by category", hint: "Where the money went" },
  { id: "earned", label: "Earned by category", hint: "Where the money came from" },
  { id: "mood", label: "Mood distribution", hint: "How the days felt" },
  { id: "savings", label: "Savings", hint: "Added vs broken" },
  { id: "moodTags", label: "Mood was about", hint: "Tag frequency" },
  { id: "categories", label: "Category frequency", hint: "Most-used categories" },
] as const;

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]["id"];

const IDS = new Set<string>(DASHBOARD_SECTIONS.map((s) => s.id));

/** Keep only known section ids (stored values may predate a rename). */
export function parseHiddenSections(raw: unknown): DashboardSectionId[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((x): x is DashboardSectionId => typeof x === "string" && IDS.has(x));
}

/**
 * Every section in the order the user put them in (Settings → Dashboard). A
 * section the stored order doesn't mention yet — one added in a later version —
 * takes its default place, right after the section it follows by default.
 */
export function orderSections(order: readonly string[] | null | undefined): DashboardSectionId[] {
  const out = [...new Set((order ?? []).filter((x): x is DashboardSectionId => IDS.has(x)))];
  DASHBOARD_SECTIONS.forEach((s, i) => {
    if (out.includes(s.id)) return;
    const before = DASHBOARD_SECTIONS.slice(0, i)
      .map((x) => x.id)
      .reverse()
      .find((id) => out.includes(id));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, s.id);
  });
  return out;
}
