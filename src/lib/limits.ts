// Longest text each field accepts. db/security.sql enforces the same limits with
// CHECK constraints; the inputs stop here so a long value never turns into a
// database error.
export const LIMITS = {
  name: 100, // categories, activities, bills
  title: 200, // goals, journal entries
  place: 200,
  note: 1000, // transaction + mood notes
  body: 20000, // journal entry text
} as const;
