// @vitest-environment happy-dom
// Regression test for cross-page selection persistence.
//
// Root cause this locks in: the management-table selection is a GLOBAL set
// across pagination pages. Two prior bugs wiped it on navigation:
//   1. pagination handlers called `deselectAll()` alongside `setPage(...)`, and
//   2. `selectAll(ids)` did `new Set(ids)` (REPLACE) instead of merging, so the
//      "select all on this page" button discarded other pages' selections, and
//      its toggle branch (`deselectAll()`) nuked every page.
// Fix: `selectAll` now merges; a new `deselectPage(ids)` removes only the
// current page. Navigating pages must never clear the set.
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBulkSelection } from "@/lib/useBulkSelection";

describe("useBulkSelection", () => {
  it("selectAll merges across pages instead of replacing", () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.selectAll(["a", "b"])); // "page 1"
    act(() => result.current.selectAll(["c"])); // "page 2"

    expect(result.current.getSelectedArray().sort()).toEqual(["a", "b", "c"]);
    expect(result.current.selectedCount).toBe(3);
  });

  it("selection persists across simulated page changes", () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.selectAll(["a", "b"])); // select all on page 1
    // "navigate" to page 2 and select-all there — page 1 must survive
    act(() => result.current.selectAll(["c"]));

    expect(result.current.isAllSelected(["a", "b"])).toBe(true); // page 1 still fully selected
    expect(result.current.isAllSelected(["c"])).toBe(true); // page 2 selected too
  });

  it("deselectPage removes only the given ids and ignores unknown ones", () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.selectAll(["a", "b", "c", "d"]));
    act(() => result.current.deselectPage(["b", "z"])); // z unknown, must not throw

    expect(result.current.getSelectedArray().sort()).toEqual(["a", "c", "d"]);
  });

  it("deselectPage does not touch other pages' selections", () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.selectAll(["a", "b", "c", "d"]));
    act(() => result.current.deselectPage(["a", "b"])); // toggle off "page 1"

    expect(result.current.isAllSelected(["c", "d"])).toBe(true); // "page 2" untouched
    expect(result.current.isAllSelected(["a", "b"])).toBe(false);
  });

  it("deselectAll still clears everything (exit-select / post-bulk)", () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.selectAll(["a", "b"]));
    act(() => result.current.deselectAll());

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.getSelectedArray()).toEqual([]);
  });

  it("toggleSelect adds then removes", () => {
    const { result } = renderHook(() => useBulkSelection());

    act(() => result.current.toggleSelect("a"));
    expect(result.current.isSelected("a")).toBe(true);
    act(() => result.current.toggleSelect("a"));
    expect(result.current.isSelected("a")).toBe(false);
  });

  it("isAllSelected is false for an empty page", () => {
    const { result } = renderHook(() => useBulkSelection());
    expect(result.current.isAllSelected([])).toBe(false);
  });
});
