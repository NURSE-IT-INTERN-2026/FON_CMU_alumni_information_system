import { describe, it, expect } from "vitest";
import { clampPaging, MAX_LIST_PAGE_SIZE } from "@/lib/pagination";

// Regression test for security #13: list endpoints must bound page/pageSize so
// `?pageSize=9999999` (DoS) and `?pageSize=abc` (NaN→500) are both handled.
describe("clampPaging (security #13)", () => {
  it("passes through valid values within bounds", () => {
    expect(clampPaging(1, 10)).toEqual({ page: 1, pageSize: 10 });
    expect(clampPaging(3, 50)).toEqual({ page: 3, pageSize: 50 });
  });

  it("caps pageSize at MAX_LIST_PAGE_SIZE", () => {
    expect(clampPaging(1, 9_999_999).pageSize).toBe(MAX_LIST_PAGE_SIZE);
  });

  it("floors page to 1 (no negative/zero skip)", () => {
    expect(clampPaging(0, 10).page).toBe(1);
    expect(clampPaging(-5, 10).page).toBe(1);
  });

  it("coerces NaN to defaults (the parseInt('abc') path)", () => {
    expect(clampPaging(NaN, NaN)).toEqual({ page: 1, pageSize: 10 });
    expect(clampPaging(2, NaN).pageSize).toBe(10);
  });

  it("honors custom defaultPageSize + maxPageSize", () => {
    expect(clampPaging(1, NaN, { defaultPageSize: 20 }).pageSize).toBe(20);
    expect(clampPaging(1, 9_999_999, { maxPageSize: 50_000 }).pageSize).toBe(50_000);
  });

  it("floors fractional values", () => {
    expect(clampPaging(2.9, 15.7)).toEqual({ page: 2, pageSize: 15 });
  });
});
