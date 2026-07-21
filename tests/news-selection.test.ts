import { describe, it, expect } from "vitest";
import {
  statusGroup,
  canSelect,
  resolveSelectAllTargetIds,
  type SelectionGroup,
} from "@/lib/news-selection";

const item = (id: string, status: "DRAFT" | "PUBLISHED" | "DISCONTINUED") => ({ id, status });

describe("statusGroup", () => {
  it("maps PUBLISHED to published, DRAFT/DISCONTINUED to unpublished", () => {
    expect(statusGroup("PUBLISHED")).toBe("published");
    expect(statusGroup("DRAFT")).toBe("unpublished");
    expect(statusGroup("DISCONTINUED")).toBe("unpublished");
  });
});

describe("canSelect", () => {
  it("allows any status when no group is locked", () => {
    expect(canSelect("PUBLISHED", null)).toBe(true);
    expect(canSelect("DRAFT", null)).toBe(true);
    expect(canSelect("DISCONTINUED", null)).toBe(true);
  });

  it("allows only matching-group statuses once a group is locked", () => {
    const published: SelectionGroup = "published";
    const unpublished: SelectionGroup = "unpublished";
    expect(canSelect("PUBLISHED", published)).toBe(true);
    expect(canSelect("DRAFT", published)).toBe(false);
    expect(canSelect("DISCONTINUED", published)).toBe(false);
    expect(canSelect("DRAFT", unpublished)).toBe(true);
    expect(canSelect("DISCONTINUED", unpublished)).toBe(true);
    expect(canSelect("PUBLISHED", unpublished)).toBe(false);
  });
});

describe("resolveSelectAllTargetIds", () => {
  it("returns empty for an empty page", () => {
    expect(resolveSelectAllTargetIds([], null)).toEqual({ ids: [], group: null });
    expect(resolveSelectAllTargetIds([], "published")).toEqual({ ids: [], group: "published" });
  });

  it("locks to a homogeneous page's group when none is locked", () => {
    const page = [item("1", "DRAFT"), item("2", "DISCONTINUED")]; // both unpublished
    expect(resolveSelectAllTargetIds(page, null)).toEqual({
      ids: ["1", "2"],
      group: "unpublished",
    });
  });

  it("returns no target on a mixed page when no group is locked", () => {
    const page = [item("1", "PUBLISHED"), item("2", "DRAFT")];
    expect(resolveSelectAllTargetIds(page, null)).toEqual({ ids: [], group: null });
  });

  it("targets only the locked group's items on a mixed page", () => {
    const page = [item("1", "PUBLISHED"), item("2", "DRAFT"), item("3", "PUBLISHED")];
    expect(resolveSelectAllTargetIds(page, "published")).toEqual({
      ids: ["1", "3"],
      group: "published",
    });
    expect(resolveSelectAllTargetIds(page, "unpublished")).toEqual({
      ids: ["2"],
      group: "unpublished",
    });
  });

  it("targets only the locked group's items on a homogeneous page too", () => {
    const page = [item("1", "PUBLISHED"), item("2", "PUBLISHED")];
    expect(resolveSelectAllTargetIds(page, "unpublished")).toEqual({
      ids: [],
      group: "unpublished",
    });
  });
});
