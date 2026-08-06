import { describe, it, expect } from "vitest";
import {
  bangkokParts,
  monthStartInstantBangkok,
  msUntilNextFirstOfMonthBangkok,
  armDelayMs,
  hasSyncedSince,
  CAP_MS,
} from "../lib/cmu-scheduler";

// Bangkok is UTC+7 (fixed, no DST). 00:00 Bangkok = 17:00 UTC the previous day.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
/** UTC instant of 00:00 on the 1st of Bangkok-month (y, m0). */
const firstOf = (y: number, m0: number) => new Date(Date.UTC(y, m0, 1) - BANGKOK_OFFSET_MS);

describe("bangkokParts", () => {
  it("reads Bangkok wall-clock parts (UTC+7)", () => {
    // 2026-08-15 03:00 UTC == 2026-08-15 10:00 Bangkok
    const p = bangkokParts(new Date(Date.UTC(2026, 7, 15, 3, 0, 0)));
    expect(p).toEqual({ y: 2026, m0: 7, d: 15, h: 10, min: 0, s: 0 });
  });

  it("rolls the date forward across the +7 offset", () => {
    // 2026-08-15 18:00 UTC == 2026-08-16 01:00 Bangkok (next day, small hours)
    const p = bangkokParts(new Date(Date.UTC(2026, 7, 15, 18, 0, 0)));
    expect(p.d).toBe(16);
    expect(p.h).toBe(1);
    expect(p.m0).toBe(7);
  });

  it("rolls into the next month at the Bangkok boundary, not the UTC one", () => {
    // 2026-08-31 18:00 UTC == 2026-09-01 01:00 Bangkok → September
    const p = bangkokParts(new Date(Date.UTC(2026, 7, 31, 18, 0, 0)));
    expect(p.m0).toBe(8); // September
    expect(p.d).toBe(1);
  });
});

describe("monthStartInstantBangkok", () => {
  it("is 00:00 on the 1st of now's Bangkok month (== 17:00 UTC prev day)", () => {
    const now = new Date(Date.UTC(2026, 7, 15, 3, 0, 0)); // Aug in Bangkok
    expect(monthStartInstantBangkok(now)).toEqual(firstOf(2026, 7));
  });

  it("follows the Bangkok month even near the UTC month seam", () => {
    // 2026-09-01 00:30 UTC == 2026-09-01 07:30 Bangkok → September, start = firstOf(2026,8)
    const now = new Date(Date.UTC(2026, 8, 1, 0, 30, 0));
    expect(monthStartInstantBangkok(now)).toEqual(firstOf(2026, 8));
  });
});

describe("msUntilNextFirstOfMonthBangkok", () => {
  it("targets this month's 1st when now is still before it", () => {
    // 2026-07-31 16:30 UTC == 2026-07-31 23:30 Bangkok → next is Aug 1 00:00 BKK
    const now = new Date(Date.UTC(2026, 6, 31, 16, 30, 0));
    const target = firstOf(2026, 7); // Aug 1 00:00 Bangkok
    expect(now.getTime() + msUntilNextFirstOfMonthBangkok(now)).toBe(target.getTime());
    expect(msUntilNextFirstOfMonthBangkok(now)).toBe(30 * 60 * 1000); // 30 min
  });

  it("targets next month's 1st once now is past this month's 1st (mid-month)", () => {
    // 2026-08-15 03:00 UTC == 2026-08-15 10:00 Bangkok → next is Sep 1
    const now = new Date(Date.UTC(2026, 7, 15, 3, 0, 0));
    const target = firstOf(2026, 8); // Sep 1 00:00 Bangkok
    expect(now.getTime() + msUntilNextFirstOfMonthBangkok(now)).toBe(target.getTime());
  });

  it("targets next month's 1st immediately after this month's 1st passes", () => {
    // 2026-08-01 00:30 UTC == 2026-08-01 07:30 Bangkok → already past Aug 1 00:00 BKK
    const now = new Date(Date.UTC(2026, 7, 1, 0, 30, 0));
    const target = firstOf(2026, 8); // Sep 1 00:00 Bangkok
    expect(now.getTime() + msUntilNextFirstOfMonthBangkok(now)).toBe(target.getTime());
  });

  it("crosses the Dec→Jan year boundary", () => {
    // 2025-12-31 16:30 UTC == 2025-12-31 23:30 Bangkok → next is Jan 1 2026
    const now = new Date(Date.UTC(2025, 11, 31, 16, 30, 0));
    const target = firstOf(2026, 0); // Jan 1 00:00 Bangkok
    expect(now.getTime() + msUntilNextFirstOfMonthBangkok(now)).toBe(target.getTime());
  });
});

describe("armDelayMs (the 2^31 setTimeout guard)", () => {
  it("never exceeds CAP_MS, however far the next 1st is", () => {
    const samples = [
      new Date(Date.UTC(2026, 7, 2, 3, 0, 0)), // Aug 2 — ~30 days to Sep 1
      new Date(Date.UTC(2026, 7, 15, 3, 0, 0)), // mid-month
      new Date(Date.UTC(2026, 6, 31, 16, 30, 0)), // 30 min before Aug 1
      new Date(Date.UTC(2025, 11, 31, 16, 30, 0)), // Dec→Jan boundary
    ];
    for (const now of samples) {
      expect(armDelayMs(now)).toBeLessThanOrEqual(CAP_MS);
    }
  });

  it("equals the exact time-to-target when that is within the cap (converges on 00:00)", () => {
    // 30 min before the 1st → arm exactly to the 1st, no capping.
    const now = new Date(Date.UTC(2026, 6, 31, 16, 30, 0));
    expect(armDelayMs(now)).toBe(msUntilNextFirstOfMonthBangkok(now));
    expect(armDelayMs(now)).toBe(30 * 60 * 1000);
  });

  it("is capped when the next 1st is farther than CAP_MS away", () => {
    // Aug 2 → ~30 days to Sep 1 (> CAP_MS) → arm is exactly the cap.
    const now = new Date(Date.UTC(2026, 7, 2, 3, 0, 0));
    expect(armDelayMs(now)).toBe(CAP_MS);
  });
});

describe("hasSyncedSince (idempotency decision)", () => {
  const monthStart = firstOf(2026, 7); // Aug 1 00:00 Bangkok

  it("is false when there is no prior log", () => {
    expect(hasSyncedSince(null, monthStart)).toBe(false);
  });

  it("is false when the latest log predates the month start", () => {
    expect(hasSyncedSince(new Date(monthStart.getTime() - 1), monthStart)).toBe(false);
  });

  it("is true when the latest log is at/after the month start", () => {
    expect(hasSyncedSince(monthStart, monthStart)).toBe(true);
    expect(hasSyncedSince(new Date(monthStart.getTime() + 86_400_000), monthStart)).toBe(true);
  });
});
