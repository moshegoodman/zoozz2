// Shared season utilities — season comparisons are CASE-INSENSITIVE app-wide.
// Use these everywhere instead of doing direct === on season strings.

export function normalizeSeason(s) {
  return (s == null ? "" : String(s)).trim().toUpperCase();
}

export function seasonsEqual(a, b) {
  return normalizeSeason(a) === normalizeSeason(b);
}