/**
 * Split a combined Thai/Latin person name into prefix + firstName + lastName.
 *
 * Pure (no Prisma / Node-only imports) so it is safe to use from both server
 * API routes (Excel import legacy-column fallback) and one-off scripts (the
 * name-split backfill). The logic mirrors `scripts/rebuild-awards.ts`:
 * strip a leading title prefix, then take the first remaining token as the
 * given name and the rest as the family name.
 */

// Ordered longest-first within a category so multi-word prefixes match before
// their shorter substrings (e.g. "ศาสตราจารย์ ดร." before "ศาสตราจารย์").
const TITLE_PREFIXES = [
  "ศาสตราจารย์ ดร.",
  "ศ.ดร.",
  "ศ. ดร.",
  "รศ.ดร.",
  "รศ ดร.",
  "ผศ.ดร.",
  "ผศ ดร.",
  "อ.ดร.",
  "อ ดร.",
  "ศาสตราจารย์",
  "ศ.",
  "รศ.",
  "รศ ",
  "ผศ.",
  "ผศ ",
  "อาจารย์",
  "อจ.",
  "อ.",
  "มล.",
  "มล ",
  "คุณหญิง",
  "คุณหม่อม",
  "คุณ",
  "นายแพทย์",
  "นพ.",
  "แพทย์หญิง",
  "พญ.",
  "นางสาว",
  "นาย",
  "นาง",
  "Prof.",
  "Assoc.Prof.",
  "Asst.Prof.",
  "Dr.",
];

export interface ParsedName {
  prefix: string | null;
  firstName: string;
  lastName: string;
}

/**
 * Repeatedly strip leading title prefixes. Returns the accumulated prefix
 * (null if none) and the remainder of the name.
 */
export function stripTitlePrefix(raw: string): { prefix: string | null; rest: string } {
  let s = raw.trim();
  let prefix = "";
  for (;;) {
    const before = s;
    for (const p of TITLE_PREFIXES) {
      if (s.startsWith(p)) {
        prefix += (prefix ? " " : "") + p.trim();
        s = s.slice(p.length).trim();
        break;
      }
    }
    if (s === before) break;
  }
  return { prefix: prefix || null, rest: s };
}

/**
 * Split a combined full name into prefix / firstName / lastName.
 *
 * - Collapses runs of whitespace.
 * - Strips a leading title prefix into `prefix`.
 * - First remaining whitespace-delimited token → `firstName`; the rest → `lastName`.
 * - A single-token name → that token is `firstName` and `lastName` is "" (caller
 *   decides how to handle a missing family name, e.g. for required columns).
 */
export function splitFullName(raw: string): ParsedName {
  const name = raw.replace(/\s+/g, " ").trim();
  const { prefix, rest } = stripTitlePrefix(name);
  const parts = rest.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { prefix, firstName, lastName };
}
