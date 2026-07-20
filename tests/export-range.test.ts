import { describe, it, expect } from "vitest";
import { resolveRowRange } from "@/lib/excel-export";

/**
 * resolveRowRange clamps a user-supplied 1-based [start,end] against the total
 * matching-row count N for the export-row-range feature. Rules:
 *   - start missing / <1 / >N  -> 1
 *   - end   missing / >N / <1  -> N
 *   - both empty               -> {1, N} (export everything)
 * Consumers slice with `items.slice(start - 1, end)` (1-based inclusive).
 */

const N = 20;

const slice = (start: string | null, end: string | null, total = N) => {
  const { start: s, end: e } = resolveRowRange(start, end, total);
  // emulate the route: items.slice(start - 1, end)
  return { start: s, end: e, count: Math.max(0, Math.min(total, e) - (s - 1)) };
};

describe("resolveRowRange", () => {
  it("defaults to the full range when both params are missing", () => {
    expect(slice(null, null)).toEqual({ start: 1, end: N, count: N });
  });

  it("defaults to the full range when both params are empty strings", () => {
    expect(slice("", "")).toEqual({ start: 1, end: N, count: N });
  });

  it("honours a valid sub-range", () => {
    expect(slice("5", "10")).toEqual({ start: 5, end: 10, count: 6 });
  });

  it("start only -> from start to the end", () => {
    expect(slice("5", null)).toEqual({ start: 5, end: N, count: N - 5 + 1 });
  });

  it("end only -> from the top to end", () => {
    expect(slice(null, "10")).toEqual({ start: 1, end: 10, count: 10 });
  });

  it("start > N -> resets to row 1 (export from the top)", () => {
    expect(slice("99999", null)).toEqual({ start: 1, end: N, count: N });
  });

  it("end > N -> resets to N (the end of the table)", () => {
    expect(slice(null, "99999")).toEqual({ start: 1, end: N, count: N });
  });

  it("end < 1 -> resets to N (the end of the table)", () => {
    expect(slice(null, "0")).toEqual({ start: 1, end: N, count: N });
    expect(slice(null, "-5")).toEqual({ start: 1, end: N, count: N });
  });

  it("start < 1 -> resets to 1", () => {
    expect(slice("0", null)).toEqual({ start: 1, end: N, count: N });
    expect(slice("-3", null)).toEqual({ start: 1, end: N, count: N });
  });

  it("an inverted range (start > end) yields an empty slice", () => {
    // both individually valid, but start(10) > end(5): documented user-error edge
    const r = slice("10", "5");
    expect(r.start).toBe(10);
    expect(r.end).toBe(5);
    expect([1, 2, 3, 4, 5, 6, 7, 8].slice(r.start - 1, r.end)).toEqual([]);
  });

  it("N = 0 -> empty slice (no matching rows)", () => {
    const r = slice("5", "10", 0);
    expect(r).toEqual({ start: 1, end: 0, count: 0 });
  });

  it("floors non-integer params", () => {
    expect(slice("5.9", "10.1")).toEqual({ start: 5, end: 10, count: 6 });
  });

  it("treats non-numeric params as missing", () => {
    expect(slice("abc", null)).toEqual({ start: 1, end: N, count: N });
    expect(slice(null, "abc")).toEqual({ start: 1, end: N, count: N });
  });
});
