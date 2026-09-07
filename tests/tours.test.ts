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
            // A later string whose EXACT path is claimed by an earlier one
            // never matches.
            expect(
              later === earlier || later.startsWith(`${earlier}/`),
              `"${later}" is shadowed by earlier string "${earlier}"`,
            ).toBe(false);
          } else {
            // An earlier RegExp matching the later string's exact path steals
            // that route (e.g. a detail regex listed before the /new string).
            // Deeper children under the string are the regex's by design —
            // that layering is intended, so no probe check here.
            expect(
              earlier.test(later),
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
            // A parent string listed BEFORE its detail regex swallows the
            // detail routes (probe = a typical [id] child). On the string's
            // EXACT path the string tour SHOULD win (the /new-before-regex
            // rule), so only the child probe is a failure.
            expect(
              later.test(`${earlier}/probe`),
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
    ["alumni", "/graduates/forum/new", "alumni-forum-new"],
    ["alumni", "/graduates/forum/9af1c3d5-2ea1-4b8e-9d0a-6f5b7c8d9e0f", "alumni-forum-detail"],
    ["alumni", "/graduates/forum/9af1c3d5-2ea1-4b8e-9d0a-6f5b7c8d9e0f/", "alumni-forum-detail"],
    ["alumni", "/graduates/forum", "alumni-forum"],
    ["alumni", "/graduates/events/new", "alumni-events-new"],
    ["alumni", "/graduates/events/9af1c3d5-2ea1-4b8e-9d0a-6f5b7c8d9e0f", "alumni-events-detail"],
    ["alumni", "/graduates/events", "alumni-events"],
    ["alumni", "/graduates/feed/9af1c3d5-2ea1-4b8e-9d0a-6f5b7c8d9e0f", "alumni-feed-detail"],
    ["alumni", "/graduates/feed", "alumni-feed"],
    ["alumni", "/graduates/directory/9af1c3d5-2ea1-4b8e-9d0a-6f5b7c8d9e0f", "alumni-directory-detail"],
    ["alumni", "/graduates/directory", "alumni-directory"],
    ["alumni", "/graduates/groups/cohort-25", "alumni-groups-detail"],
    ["alumni", "/graduates/groups", "alumni-groups"],
    ["alumni", "/graduates/news/9af1c3d5-2ea1-4b8e-9d0a-6f5b7c8d9e0f", "alumni-news-detail"],
    ["alumni", "/graduates/news", "alumni-news"],
    ["alumni", "/graduates/jobs", "alumni-jobs"],
    ["alumni", "/graduates/announcements", "alumni-announcements"],
    ["alumni", "/graduates/notifications", "alumni-notifications"],
    // admin CRUD batch
    ["admin", "/management/associations", "admin-associations"],
    ["admin", "/management/graduate-committee", "admin-graduate-committee"],
    ["admin", "/management/model-representatives", "admin-model-representatives"],
    ["admin", "/management/potentials", "admin-potentials"],
    ["admin", "/management/awards", "admin-awards"],
    ["admin", "/management/alumni-agency", "admin-alumni-agency"],
    // admin batch 2
    ["admin", "/management/alumni-activity", "admin-alumni-activity"],
    ["admin", "/management/new-alumni", "admin-new-alumni"],
    ["admin", "/management/alumni/550123456", "admin-alumni-detail"],
    ["admin", "/management/alumni/550123456/", "admin-alumni-detail"],
    ["admin", "/management/forum", "admin-forum"],
    ["admin", "/management/events", "admin-events"],
    ["admin", "/management/announcements", "admin-announcements"],
    ["admin", "/management/settings/profile", "admin-settings-profile"],
    ["admin", "/management/settings/users", "admin-settings-users"],
    ["admin", "/management/settings/logs", "admin-settings-logs"],
    ["admin", "/management/settings/cmu-sync", "admin-settings-cmu-sync"],
    ["admin", "/management/settings/trash", "admin-settings-trash"],
  ];

  it.each(CASES)("tourForPath(%j, %j) → %s", (area, path, expected) => {
    expect(tourForPath(area as "admin" | "alumni", path)?.id ?? undefined).toBe(expected);
  });
});
