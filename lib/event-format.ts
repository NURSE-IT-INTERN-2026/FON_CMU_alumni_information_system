/**
 * Bangkok-aware Thai (Buddughtist-calendar) datetime formatting for community
 * events. Client-safe (pure).
 *
 * Event start/end are stored as UTC instants, but the datetime-local picker
 * gives a NAIVE Bangkok wall-clock string — the route appends "+07:00" before
 * parsing so the stored instant is exactly that Bangkok wall-clock. This
 * formatter reverses that: shift the UTC instant +7h and read the UTC parts to
 * recover Bangkok wall-clock, then format with Thai months + a Buddhist-era
 * year (+543). Deterministic regardless of the server's TZ env.
 */
const MONTHS_TH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const MONTHS_TH_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function bangkokParts(d: Date) {
  const bkk = new Date(d.getTime() + 7 * 3600 * 1000);
  return {
    year: bkk.getUTCFullYear(),
    month: bkk.getUTCMonth(),
    day: bkk.getUTCDate(),
    hours: bkk.getUTCHours(),
    minutes: bkk.getUTCMinutes(),
  };
}

export function formatEventDateTimeThai(
  iso: string | Date | null,
  opts?: { fullMonth?: boolean },
): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = bangkokParts(d);
  const months = opts?.fullMonth ? MONTHS_TH_FULL : MONTHS_TH_SHORT;
  const hh = String(p.hours).padStart(2, "0");
  const mm = String(p.minutes).padStart(2, "0");
  return `${p.day} ${months[p.month]} ${p.year + 543} · ${hh}:${mm} น.`;
}

/** Just the date part (no time) — for compact list cards. */
export function formatEventDateThai(iso: string | Date | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = bangkokParts(d);
  return `${p.day} ${MONTHS_TH_SHORT[p.month]} ${p.year + 543}`;
}

/**
 * Convert a naive datetime-local string ("YYYY-MM-DDTHH:mm") to an ISO string
 * interpreted as Bangkok time (appends +07:00). Used by the create/update
 * routes before storing as a UTC instant.
 */
export function bangkokDatetimeLocalToIso(value: string): string {
  // If it already carries offset/Z, leave it; otherwise pin to +07:00.
  return /[+-]\d\d:?\d\d$|Z$/.test(value) ? value : `${value}+07:00`;
}

/**
 * Reverse of bangkokDatetimeLocalToIso: a stored UTC instant → the naive
 * "YYYY-MM-DDTHH:mm" Bangkok wall-clock string that a datetime-local input
 * expects (used to prefill edit forms).
 */
export function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = bangkokParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hours)}:${pad(p.minutes)}`;
}
