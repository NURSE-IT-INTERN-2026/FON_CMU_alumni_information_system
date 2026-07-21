import { describe, it, expect } from "vitest";
import {
  canSelect,
  resolveSelectAllTargetIds,
  pinToggleKind,
  type NewsStatus,
} from "@/lib/news-selection";

const item = (id: string, status: NewsStatus, pinned = false) => ({ id, status, pinnedAt: pinned ? "2026-01-01" : null });

describe("canSelect", () => {
  it("allows any status when none is locked", () => {
    expect(canSelect("PUBLISHED", null)).toBe(true);
    expect(canSelect("DRAFT", null)).toBe(true);
    expect(canSelect("DISCONTINUED", null)).toBe(true);
  });

  it("allows only the locked status once one is picked", () => {
    expect(canSelect("PUBLISHED", "PUBLISHED")).toBe(true);
    expect(canSelect("DRAFT", "PUBLISHED")).toBe(false);
    expect(canSelect("PUBLISHED", "DRAFT")).toBe(false);
    // DRAFT and DISCONTINUED are now SEPARATE groups (not one "unpublished" bucket).
    expect(canSelect("DISCONTINUED", "DRAFT")).toBe(false);
    expect(canSelect("DRAFT", "DISCONTINUED")).toBe(false);
    expect(canSelect("DISCONTINUED", "DISCONTINUED")).toBe(true);
  });
});

describe("resolveSelectAllTargetIds", () => {
  it("returns empty for an empty page", () => {
    expect(resolveSelectAllTargetIds([], null)).toEqual({ ids: [], status: null });
    expect(resolveSelectAllTargetIds([], "PUBLISHED")).toEqual({ ids: [], status: "PUBLISHED" });
  });

  it("locks to a homogeneous page's status when none is locked", () => {
    const page = [item("1", "DRAFT"), item("2", "DRAFT")];
    expect(resolveSelectAllTargetIds(page, null)).toEqual({ ids: ["1", "2"], status: "DRAFT" });
  });

  it("returns no target on a mixed page (incl. DRAFT+DISCONTINUED) when no status is locked", () => {
    expect(resolveSelectAllTargetIds([item("1", "PUBLISHED"), item("2", "DRAFT")], null)).toEqual({
      ids: [],
      status: null,
    });
    // DRAFT + DISCONTINUED are separate statuses → mixed.
    expect(resolveSelectAllTargetIds([item("1", "DRAFT"), item("2", "DISCONTINUED")], null)).toEqual({
      ids: [],
      status: null,
    });
  });

  it("targets only the locked status's items on a mixed page", () => {
    const page = [item("1", "PUBLISHED"), item("2", "DRAFT"), item("3", "PUBLISHED")];
    expect(resolveSelectAllTargetIds(page, "PUBLISHED")).toEqual({ ids: ["1", "3"], status: "PUBLISHED" });
    expect(resolveSelectAllTargetIds(page, "DRAFT")).toEqual({ ids: ["2"], status: "DRAFT" });
  });

  it("excludes pinned items even when the status is locked", () => {
    const page = [item("1", "PUBLISHED", true), item("2", "PUBLISHED"), item("3", "PUBLISHED")];
    // Locked PUBLISHED: only the non-pinned ones (pinned are never grabbed by select-all).
    expect(resolveSelectAllTargetIds(page, "PUBLISHED")).toEqual({ ids: ["2", "3"], status: "PUBLISHED" });
    // No lock but all non-pinned share one status → auto-lock, exclude the pinned.
    expect(resolveSelectAllTargetIds(page, null)).toEqual({ ids: ["2", "3"], status: "PUBLISHED" });
  });

  it("targets nothing when the locked status is absent on the page", () => {
    expect(resolveSelectAllTargetIds([item("1", "PUBLISHED"), item("2", "PUBLISHED")], "DRAFT")).toEqual({
      ids: [],
      status: "DRAFT",
    });
  });
});

describe("pinToggleKind", () => {
  it("is 'pin' when none of the selected are pinned (or selection empty)", () => {
    expect(pinToggleKind(0, 0)).toBe("pin");
    expect(pinToggleKind(0, 3)).toBe("pin");
  });

  it("is 'unpin' when all selected are pinned", () => {
    expect(pinToggleKind(3, 3)).toBe("unpin");
  });

  it("is 'toggle' when the selection mixes pinned and unpinned", () => {
    expect(pinToggleKind(1, 3)).toBe("toggle");
    expect(pinToggleKind(2, 3)).toBe("toggle");
  });
});
