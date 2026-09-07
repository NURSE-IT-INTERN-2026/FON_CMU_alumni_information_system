import { describe, it, expect } from "vitest";
import { TOURS, tourForPath, type TourDefinition } from "@/lib/tours";

const TARGET_ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

/** All steps across all tours — helper for the uniqueness/copy checks below. */
function allTours(): TourDefinition[] {
  return [...TOURS];
}

describe("tour registry invariants", () => {
  it("has unique tour ids", () => {
    const ids = allTours().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has non-overlapping string pathPatterns within an area", () => {
    for (const area of ["admin", "alumni"] as const) {
      const patterns = allTours()
        .filter((t) => t.area === area && typeof t.pathPattern === "string")
        .map((t) => t.pathPattern as string);
      expect(new Set(patterns).size).toBe(patterns.length);
    }
  });

  it("every step has non-empty Thai title and body", () => {
    for (const tour of allTours()) {
      for (const [i, step] of tour.steps.entries()) {
        expect(step.title.trim().length, `${tour.id} step ${i} title`).toBeGreaterThan(1);
        expect(step.body.trim().length, `${tour.id} step ${i} body`).toBeGreaterThan(1);
      }
    }
  });

  it("every tour has at least one centered (target: null) step", () => {
    for (const tour of allTours()) {
      expect(
        tour.steps.some((s) => s.target === null),
        `${tour.id} has no target:null fallback step`,
      ).toBe(true);
    }
  });

  it("target ids are unique within a tour and follow the kebab-case convention", () => {
    for (const tour of allTours()) {
      const targets = tour.steps
        .map((s) => s.target)
        .filter((t): t is string => t !== null);
      expect(new Set(targets).size, `${tour.id} has duplicate targets`).toBe(targets.length);
      for (const target of targets) {
        expect(target, `${tour.id} target "${target}"`).toMatch(TARGET_ID_RE);
      }
    }
  });
});

describe("tourForPath", () => {
  it("matches the exact path", () => {
    expect(tourForPath("alumni", "/graduates/profile")?.id).toBe("alumni-profile");
  });

  it("matches child paths", () => {
    expect(tourForPath("alumni", "/graduates/profile/anything")?.id).toBe("alumni-profile");
  });

  it("ignores trailing slashes", () => {
    expect(tourForPath("alumni", "/graduates/profile/")?.id).toBe("alumni-profile");
  });

  it("does not match sibling prefixes", () => {
    expect(tourForPath("alumni", "/graduates/profiles")).toBeUndefined();
  });

  it("is area-scoped (an admin path never matches an alumni tour)", () => {
    expect(tourForPath("admin", "/graduates/profile")).toBeUndefined();
    expect(tourForPath("alumni", "/management/dashboard")).toBeUndefined();
  });

  it("returns undefined for a page without a tour", () => {
    expect(tourForPath("alumni", "/graduates/jobs")).toBeUndefined();
    expect(tourForPath("admin", "/management/awards")).toBeUndefined();
  });
});
