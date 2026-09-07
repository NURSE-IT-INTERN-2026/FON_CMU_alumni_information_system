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
    expect(tourForPath("alumni", "/graduates/tos")).toBeUndefined();
    expect(tourForPath("admin", "/management")).toBeUndefined();
  });
});

describe("registry ordering (first-match-wins — specific patterns must precede their parents)", () => {
  // tourForPath uses TOURS.find(): a string pattern matches its exact path or
  // any child. If a parent pattern is listed before a pattern for one of its
  // child pages, the parent silently swallows the child route. These probes
  // pin the child-before-parent ordering.
  it("no later string pattern is shadowed by an earlier pattern", () => {
    for (const area of ["admin", "alumni"] as const) {
      const patterns = allTours()
        .filter((t) => t.area === area)
        .map((t) => t.pathPattern);
      for (let j = 0; j < patterns.length; j++) {
        const later = patterns[j];
        if (typeof later !== "string") continue;
        for (let i = 0; i < j; i++) {
          const earlier = patterns[i];
          if (typeof earlier === "string") {
            // A later string that is a child of an earlier one never matches.
            expect(
              later === earlier || later.startsWith(`${earlier}/`),
              `"${later}" is shadowed by earlier string "${earlier}"`,
            ).toBe(false);
          } else {
            // An earlier RegExp that matches a later string's path (or a
            // child of it) steals that route.
            expect(
              earlier.test(later) || earlier.test(`${later}/probe`),
              `"${later}" is shadowed by earlier RegExp ${earlier}`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it("no later RegExp pattern is shadowed by an earlier string parent", () => {
    for (const area of ["admin", "alumni"] as const) {
      const patterns = allTours()
        .filter((t) => t.area === area)
        .map((t) => t.pathPattern);
      for (let j = 0; j < patterns.length; j++) {
        const later = patterns[j];
        if (!(later instanceof RegExp)) continue;
        for (let i = 0; i < j; i++) {
          const earlier = patterns[i];
          if (typeof earlier === "string") {
            // The detail regex for /x/[id] also matches /x/new — so a parent
            // string listed earlier swallows it (probe catches both shapes).
            expect(
              later.test(earlier) || later.test(`${earlier}/probe`),
              `RegExp ${later} is shadowed by earlier string "${earlier}"`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it("RegExp patterns are fully anchored with an optional trailing slash", () => {
    for (const tour of allTours()) {
      const p = tour.pathPattern;
      if (!(p instanceof RegExp)) continue;
      expect(p.source, `${tour.id} pattern ${p}`).toMatch(/^\^.*\\\/\?\$$/);
    }
  });
});

describe("golden tour resolution per route", () => {
  const CASES: [string, string, string | undefined][] = [
    // alumni
    ["alumni", "/graduates/profile", "alumni-profile"],
    // admin CRUD batch
    ["admin", "/management/associations", "admin-associations"],
    ["admin", "/management/graduate-committee", "admin-graduate-committee"],
    ["admin", "/management/model-representatives", "admin-model-representatives"],
    ["admin", "/management/potentials", "admin-potentials"],
    ["admin", "/management/awards", "admin-awards"],
    ["admin", "/management/alumni-agency", "admin-alumni-agency"],
    // the /management/alumni prefix (batch 2's admin-alumni-detail) must not
    // bleed onto sibling slugs — updated to its own tour in batch 2
    ["admin", "/management/alumni-activity", undefined],
  ];

  it.each(CASES)("tourForPath(%j, %j) → %s", (area, path, expected) => {
    expect(tourForPath(area as "admin" | "alumni", path)?.id ?? undefined).toBe(expected);
  });
});
