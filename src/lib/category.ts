/**
 * Suggest a catalogue category for a new product from its name (and file name).
 *
 * Each rule maps furniture words to the category names it usually belongs in, best
 * first; the first rule that matches and names a category the catalogue actually has
 * wins. Order matters: "dining chair" must hit the dining rule before the chair rule,
 * and "coffee table" the living-room rule before the plain "table" rule.
 */
const RULES: [RegExp, string[]][] = [
  [/\b(lamps?|lights?|lighting|lanterns?|chandeliers?|pendants?|sconces?)\b/, ['Lighting', 'Living']],
  [/\b(beds?|bedside|nightstands?|mattress(es)?|wardrobes?|closets?|almirahs?|dressers?|bedroom)\b/, ['Bedroom']],
  [/\b(dining|bar ?stools?|bar ?chairs?|sideboards?|buffets?)\b/, ['Dining', 'Seating']],
  [/\b((side|coffee|console|centre|center|end|tv) tables?|tv units?)\b/, ['Living']],
  [/\b(sofas?|couch(es)?|settees?|loveseats?|sectionals?|recliners?|armchairs?|lounge|living)\b/, ['Living', 'Seating']],
  [/\b(chairs?|stools?|benches|bench|ottomans?|poufs?|seating)\b/, ['Seating', 'Living', 'Dining']],
  [/\b(desks?|study|office|bookshel(f|ves)|bookcases?|shel(f|ves))\b/, ['Study', 'Office', 'Living']],
  [/\b(tables?)\b/, ['Dining']],
];

const norm = (s: string) => s.toLowerCase().replace(/[-_.]+/g, ' ');
const singular = (s: string) => s.replace(/(es|s)$/, '');

/** The best existing category for `texts`, or null when nothing fits well enough to suggest. */
export function suggestCategory<C extends { name: string }>(texts: readonly string[], categories: readonly C[]): C | null {
  const text = norm(texts.join(' '));
  if (!text.trim()) return null;
  const byName = (name: string) => categories.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());

  for (const [pattern, names] of RULES) {
    if (!pattern.test(text)) continue;
    for (const name of names) {
      const hit = byName(name);
      if (hit) return hit;
    }
  }
  // Custom categories (e.g. "Kitchen", "Outdoor"): suggest one whose name appears in the text.
  return categories.find((c) => {
    const word = singular(norm(c.name).trim());
    return word.length >= 3 && new RegExp(`\\b${word.replace(/[^a-z0-9 ]/g, '')}`).test(text);
  }) ?? null;
}
