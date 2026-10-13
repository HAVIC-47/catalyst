// Longest text each field accepts. db/security.sql enforces the same limits with
// CHECK constraints; the inputs stop here so a long value never turns into a
// database error.
export const LIMITS = {
  name: 100, // categories, activities, bills, boards, board columns
  title: 200, // goals, journal entries, tickets
  place: 200,
  note: 1000, // transaction + mood notes
  description: 5000, // ticket description
  body: 20000, // journal entry text
} as const;
