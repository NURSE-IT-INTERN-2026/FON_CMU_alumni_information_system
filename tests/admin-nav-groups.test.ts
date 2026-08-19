import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/lib/constants";

const hrefs = (group: (typeof NAV_GROUPS)[number]) => group.items.map((i) => i.href);

// Pins the admin main-menu classification: alumni DATA pages and alumni
// COMMUNITY pages live in separate, labeled groups so a misfiled page (or a
// flattening refactor) fails here instead of silently reshuffling the sidebar.
describe("NAV_GROUPS — admin menu grouping", () => {
  it("renders an ungrouped overview section first", () => {
    expect(NAV_GROUPS[0].title).toBeUndefined();
    expect(hrefs(NAV_GROUPS[0])).toEqual([
      "/management/dashboard",
      "/management/alumni-activity",
    ]);
  });

  it("groups the 7 alumni-data pages under ฐานข้อมูลศิษย์เก่า", () => {
    const data = NAV_GROUPS.find((g) => g.title === "ฐานข้อมูลศิษย์เก่า");
    expect(data).toBeDefined();
    expect(hrefs(data!)).toEqual([
      "/management/all-alumni",
      "/management/awards",
      "/management/potentials",
      "/management/associations",
      "/management/graduate-committee",
      "/management/model-representatives",
      "/management/alumni-agency",
    ]);
  });

  it("groups the 4 community pages (incl. news) under ชุมชนศิษย์เก่า", () => {
    const community = NAV_GROUPS.find((g) => g.title === "ชุมชนศิษย์เก่า");
    expect(community).toBeDefined();
    expect(hrefs(community!)).toEqual([
      "/management/news",
      "/management/forum",
      "/management/events",
      "/management/announcements",
    ]);
  });

  it("keeps all 13 hrefs unique and under /management/", () => {
    const all = NAV_GROUPS.flatMap(hrefs);
    expect(all).toHaveLength(13);
    expect(new Set(all).size).toBe(13);
    expect(all.every((href) => href.startsWith("/management/"))).toBe(true);
  });
});
