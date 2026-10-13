// The dashboard's sections, in display order. Users can hide any of them in
// Settings; hiding only changes what renders — the data behind it is untouched.
export const DASHBOARD_SECTIONS = [
  { id: "kpis", label: "Monthly summary", hint: "Spent · Earned · Saved · Avg mood" },
  { id: "trend", label: "Mood × money trend", hint: "Net flow vs mood over time" },
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
