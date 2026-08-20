/**
 * Pure month-grid helpers for the alumni events calendar view (client-safe,
 * no Prisma). Everything here is deterministic: dates are built with
 * Date.UTC and the Bangkok shift is the same +7h construction the rest of the
 * event stack uses (`bangkokParts` in lib/event-format.ts, the CMU scheduler's
 * monthStartInstantBangkok) — Bangkok is fixed UTC+7, no DST.
 */
import { bangkokParts } from "@/lib/event-format";
import { THAI_MONTH_FULL } from "@/lib/thai-month";

/** Thai weekday abbreviations, Sunday-first (matches BirthDateSelect). */
export const THAI_DAY_NAMES_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;

export interface MonthCursor {
  year: number;
  /** 0-based month (0 = January) — mirrors Date.getUTCMonth. */
  month: number;
}

export interface MonthCell {
  date: Date;
  /** False for the leading/trailing days padded from adjacent months. */
  inMonth: boolean;
}

const BANGKOK_OFFSET_MS = 7 * 3600 * 1000;

/** Normalize a month cursor after arithmetic (handles Dec↔Jan rollover). */
export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const zero = cursor.year * 12 + cursor.month + delta;
  return { year: Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 };
}

/**
 * Weeks-of-7 grid for a Gregorian month, Sunday-first. Each week always has
 * exactly 7 cells; leading/trailing days from adjacent months carry
 * inMonth:false so the grid renders a complete rectangle.
 */
export function buildMonthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(Date.UTC(year, month, 1));
  // 0 = Sunday … 6 = Saturday — aligns with THAI_DAY_NAMES_SHORT.
  const lead = first.getUTCDay();
  const start = new Date(first.getTime() - lead * 86400 * 1000);
  const weeks: MonthCell[][] = [];
  const totalCells = lead + new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let i = 0; i < Math.ceil(totalCells / 7) * 7; i += 7) {
    const week: MonthCell[] = [];
    for (let j = 0; j < 7; j++) {
      const date = new Date(start.getTime() + (i + j) * 86400 * 1000);
      week.push({ date, inMonth: date.getUTCMonth() === month });
    }
    weeks.push(week);
  }
  return weeks;
}

/** "สิงหาคม 2569" — full Thai month + Buddhist-era year (Gregorian + 543). */
export function thaiMonthYearLabel(cursor: MonthCursor): string {
  return `${THAI_MONTH_FULL[cursor.month]} ${cursor.year + 543}`;
}

/**
 * [from, to) ISO-instant window covering a Bangkok calendar month:
 * from = 00:00 on the 1st Bangkok = Date.UTC(y, m, 1) − 7h (and likewise for
 * the exclusive upper bound). Date.UTC's month overflow handles rollover.
 */
export function monthRangeBangkok(cursor: MonthCursor): { from: string; to: string } {
  return {
    from: new Date(Date.UTC(cursor.year, cursor.month, 1) - BANGKOK_OFFSET_MS).toISOString(),
    to: new Date(Date.UTC(cursor.year, cursor.month + 1, 1) - BANGKOK_OFFSET_MS).toISOString(),
  };
}

/**
 * "YYYY-MM-DD" of the BANGKOK wall-clock day (+7h shift — NOT the UTC day,
 * NOT browser-local). The calendar's day-bucketing key. Events bucket by
 * startAt day; a multi-day event appears only in its start month.
 */
export function bangkokDayKey(iso: string | Date): string {
  const p = bangkokParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

/** Group events into per-Bangkok-day buckets keyed by bangkokDayKey(startAt). */
export function bucketEventsByDay<T extends { startAt: string }>(events: T[]): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const e of events) {
    const key = bangkokDayKey(e.startAt);
    const list = buckets.get(key);
    if (list) list.push(e);
    else buckets.set(key, [e]);
  }
  return buckets;
}

/**
 * Parse the calendar's `?from=&to=` query params for GET /api/events.
 * Returns null unless BOTH values parse to valid dates with from < to —
 * callers fall back to the scope-based filter otherwise.
 */
export function resolveEventWindow(
  fromRaw: string | null,
  toRaw: string | null,
): { from: Date; to: Date } | null {
  if (!fromRaw || !toRaw) return null;
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return null;
  return { from, to };
}

/** The current Bangkok calendar month, for the initial cursor. */
export function currentBangkokMonth(now: Date = new Date()): MonthCursor {
  const p = bangkokParts(now);
  return { year: p.year, month: p.month };
}
