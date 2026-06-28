/**
 * Parse a raw phone string from the legacy dump into a list of clean phone
 * numbers (pure string logic — safe for client + server).
 *
 * The dump stores phones in two shapes, sometimes combined:
 *   - "<landline> มือถือ <mobile>" — keep ONLY the mobile that follows มือถือ
 *     (the landline before it is discarded, per the import spec).
 *   - "a, b, c"                   — comma-separated; each becomes its own entry.
 *
 * Also repairs the U+0130–0139 mojibake digits (İ/ı/Ĳ/ĳ/Ĵ/ĵ/Ķ/ĸ/Ĺ → 0–9) — the
 * same corruption that hit student IDs in the dump. Empty pieces are dropped.
 */
const MOJIBAKE_DIGIT_RE = /[İ-Ĺ]/g;
const MOBILE_LABEL = "มือถือ";

function normDigits(s: string): string {
  return s.replace(MOJIBAKE_DIGIT_RE, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x0130 + 0x0030),
  );
}

export function parsePhones(raw: unknown): string[] {
  let s = normDigits(String(raw ?? "")).trim();
  if (!s) return [];
  // Keep only the mobile number that follows "มือถือ" (discard the landline).
  const idx = s.indexOf(MOBILE_LABEL);
  if (idx !== -1) s = s.slice(idx + MOBILE_LABEL.length);
  return s
    .split(",")
    .map((p) => normDigits(p).trim())
    .filter((p) => p.length > 0);
}

/** Join a phones list back into a single editable/display string. */
export function joinPhones(phones: string[] | null | undefined): string {
  return (phones ?? []).filter(Boolean).join(", ");
}
