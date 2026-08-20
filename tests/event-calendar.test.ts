import { describe, it, expect } from "vitest";
import {
  THAI_DAY_NAMES_SHORT,
  buildMonthGrid,
  shiftMonth,
  thaiMonthYearLabel,
  monthRangeBangkok,
  bangkokDayKey,
  bucketEventsByDay,
  resolveEventWindow,
  currentBangkokMonth,
} from "../lib/event-calendar";

describe("buildMonthGrid", () => {
  it("builds a Sunday-first 7-column grid with correct inMonth flags (Aug 2026)", () => {
    // Aug 1, 2026 is a Saturday → 6 leading July cells.
    const weeks = buildMonthGrid(2026, 7);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const first = weeks[0];
    expect(first.filter((c) => !c.inMonth)).toHaveLength(6);
    expect(first[6]).toMatchObject({ inMonth: true });
    expect(first[6].date.getUTCDate()).toBe(1);
    // Every August day appears exactly once.
    const augustDays = weeks.flat().filter((c) => c.inMonth);
    expect(augustDays).toHaveLength(31);
  });

  it("pads trailing January cells for December (Dec 2026 → Jan 2027)", () => {
    // Dec 1, 2026 is a Tuesday → 2 leading; 31 days → 2 trailing Jan 2027.
    const weeks = buildMonthGrid(2026, 11);
    const cells = weeks.flat();
    expect(cells).toHaveLength(35);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
    const trailing = cells.filter((c) => !c.inMonth).slice(2);
    expect(trailing).toHaveLength(2);
    expect(trailing[0].date.getUTCFullYear()).toBe(2027);
    expect(trailing[0].date.getUTCMonth()).toBe(0);
  });

  it("exposes exactly 7 Thai day names starting Sunday", () => {
    expect(THAI_DAY_NAMES_SHORT).toHaveLength(7);
    expect(THAI_DAY_NAMES_SHORT[0]).toBe("อา.");
    expect(THAI_DAY_NAMES_SHORT[6]).toBe("ส.");
  });
});

describe("shiftMonth", () => {
  it("rolls December forward into January of the next year", () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  it("rolls January backward into December of the previous year", () => {
    expect(shiftMonth({ year: 2027, month: 0 }, -1)).toEqual({ year: 2026, month: 11 });
  });

  it("is a no-op for delta 0 and handles multi-month deltas", () => {
    expect(shiftMonth({ year: 2026, month: 7 }, 0)).toEqual({ year: 2026, month: 7 });
    expect(shiftMonth({ year: 2026, month: 10 }, 14)).toEqual({ year: 2028, month: 0 });
  });
});

describe("thaiMonthYearLabel", () => {
  it("renders the full Thai month + Buddhist-era year", () => {
    expect(thaiMonthYearLabel({ year: 2026, month: 7 })).toBe("สิงหาคม 2569");
    expect(thaiMonthYearLabel({ year: 2026, month: 0 })).toBe("มกราคม 2569");
  });
});

describe("monthRangeBangkok", () => {
  it("covers 00:00 on the 1st through the exclusive next 1st, Bangkok (UTC+7)", () => {
    // 00:00 Bangkok = 17:00 UTC the previous day.
    expect(monthRangeBangkok({ year: 2026, month: 7 })).toEqual({
      from: "2026-07-31T17:00:00.000Z",
      to: "2026-08-31T17:00:00.000Z",
    });
  });

  it("rolls the exclusive upper bound into January of the next year", () => {
    expect(monthRangeBangkok({ year: 2026, month: 11 }).to).toBe("2026-12-31T17:00:00.000Z");
  });
});

describe("bangkokDayKey", () => {
  it("keys by the BANGKOK wall-clock day, not the UTC day", () => {
    // 2026-08-20 01:00 Bangkok == 2026-08-19 18:00 UTC → must be 08-20.
    expect(bangkokDayKey("2026-08-20T01:00:00+07:00")).toBe("2026-08-20");
  });

  it("zero-pads month and day", () => {
    expect(bangkokDayKey("2026-11-03T12:00:00+07:00")).toBe("2026-11-03");
  });
});

describe("bucketEventsByDay", () => {
  it("groups events sharing a Bangkok day under one key", () => {
    const events = [
      { id: "a", title: "A", startAt: "2026-08-20T01:00:00+07:00" },
      { id: "b", title: "B", startAt: "2026-08-20T18:00:00+07:00" },
      { id: "c", title: "C", startAt: "2026-08-21T09:00:00+07:00" },
    ];
    const buckets = bucketEventsByDay(events);
    expect(buckets.get("2026-08-20")?.map((e) => e.id)).toEqual(["a", "b"]);
    expect(buckets.get("2026-08-21")?.map((e) => e.id)).toEqual(["c"]);
    expect(buckets.size).toBe(2);
  });
});

describe("resolveEventWindow", () => {
  it("parses a valid from/to pair", () => {
    const w = resolveEventWindow("2026-07-31T17:00:00.000Z", "2026-08-31T17:00:00.000Z");
    expect(w?.from.toISOString()).toBe("2026-07-31T17:00:00.000Z");
    expect(w?.to.toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("returns null for one-sided, garbage, or inverted input", () => {
    expect(resolveEventWindow(null, "2026-08-31T17:00:00.000Z")).toBeNull();
    expect(resolveEventWindow("2026-07-31T17:00:00.000Z", null)).toBeNull();
    expect(resolveEventWindow("garbage", "2026-08-31T17:00:00.000Z")).toBeNull();
    expect(resolveEventWindow("2026-08-31T17:00:00.000Z", "2026-07-31T17:00:00.000Z")).toBeNull();
    expect(resolveEventWindow("2026-08-01T00:00:00Z", "2026-08-01T00:00:00Z")).toBeNull();
  });
});

describe("currentBangkokMonth", () => {
  it("derives the Bangkok calendar month from an injectable now", () => {
    // 2026-12-31 20:00 UTC == 2027-01-01 03:00 Bangkok → January 2027.
    expect(currentBangkokMonth(new Date("2026-12-31T20:00:00Z"))).toEqual({ year: 2027, month: 0 });
  });
});
