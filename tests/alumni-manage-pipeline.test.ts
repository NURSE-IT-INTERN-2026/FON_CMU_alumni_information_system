import { describe, expect, it } from "vitest";
import { dedupeCmuGraduatesByPerson } from "@/lib/alumni-verify";
import { applyCmuGraduateFilters } from "@/lib/cmu-graduate-filters";
import { filterLocalAlumniRows, type LocalAlumniFilterInput } from "@/lib/alumni-local-filter";
import { mergeAlumniTableRows, type CmuAlumniInput, type LocalAlumniInput } from "@/lib/alumni-merge";
import { sortAlumni } from "@/lib/alumni-sort";
import type { CmuGraduate } from "@/lib/cmu-registrar";

/**
 * The composed client-side manage pipeline of the all-alumni page:
 *   dedupe → filter CMU → filter local → merge → sort
 * This pins the ORDER and the cross-source interactions that the individual
 * unit tests can't see — especially dedupe-BEFORE-filter (the server route
 * dedupes at route.ts:73 then filters at :77; filtering first would resurrect
 * persons whose kept degree fails the filter) and the education-studentId
 * search bridge.
 */

const grad = (over: Partial<CmuGraduate>): CmuGraduate => ({
  student_id: "1",
  birthday: "01-12-1997",
  cmuitaccount: "",
  sex_id: "",
  name_th: "สมหญิง",
  surname_th: "รักเรียน",
  name_en: "",
  surname_en: "",
  level_id: "1",
  major_name_th: "พยาบาลศาสตร์",
  grad_date: "",
  grad_year: "2560",
  ...over,
});

const local = (over: Partial<LocalAlumniInput> & { id: string; studentId: string }): LocalAlumniInput => ({
  prefix: "นาง",
  firstName: "สมหญิง",
  lastName: "รักเรียน",
  cohort: null,
  degreeLevel: "BACHELOR",
  major: null,
  graduationYear: null,
  birthDate: null,
  remarks: null,
  email: null,
  contactEmail: null,
  phones: [],
  homeAddress: null,
  isPotential: false,
  isModelRepresentative: false,
  photoUrl: null,
  ...over,
});

type ManageFilters = {
  search?: string;
  degreeLevels?: string[];
  majors?: string[];
  graduationYears?: string[];
};

/** The exact composition the all-alumni page's useMemo pipeline runs. */
function managePipeline(
  cmuRaw: CmuGraduate[],
  localRows: (LocalAlumniInput & { educations?: { studentId: string }[] })[],
  { dedupeView, search = "", degreeLevels, majors, graduationYears }: { dedupeView: boolean } & ManageFilters,
) {
  const cmuBase: CmuAlumniInput[] = dedupeView ? dedupeCmuGraduatesByPerson(cmuRaw) : cmuRaw;
  const cmuRows = applyCmuGraduateFilters(cmuBase, { search, degreeLevels, majors, graduationYears });
  const localFiltered = filterLocalAlumniRows(localRows, { search, degreeLevels, majors, graduationYears });
  const merged = mergeAlumniTableRows(cmuRows, localFiltered, { dedupeView, search });
  return sortAlumni(merged, "studentId", "asc");
}

describe("all-alumni client manage pipeline", () => {
  it("dedupes BEFORE filtering — a person whose kept (highest) degree fails the facet is gone, not downgraded", () => {
    // One person: bachelor 2560 (id 1) + doctoral 2565 (id 2). Dedupe keeps doctoral.
    const cmuRaw = [
      grad({ student_id: "1", level_id: "1", grad_year: "2560" }),
      grad({ student_id: "2", level_id: "5", grad_year: "2565" }),
    ];
    // Filter to BACHELOR-only: after dedupe the person IS doctoral → 0 rows.
    // (Filter-first would keep the bachelor record and wrongly show the person.)
    const out = managePipeline(cmuRaw, [], { dedupeView: true, degreeLevels: ["BACHELOR"] });
    expect(out).toHaveLength(0);
    // Show-all mode lists each degree record → the bachelor row appears.
    const outAll = managePipeline(cmuRaw, [], { dedupeView: false, degreeLevels: ["BACHELOR"] });
    expect(outAll).toHaveLength(1);
    expect(outAll[0].studentId).toBe("1");
  });

  it("search bridging: a local alumni whose PRIMARY id differs still collapses onto its CMU person", () => {
    const cmuRaw = [
      grad({ student_id: "1", level_id: "1", grad_year: "2560" }),
      grad({ student_id: "2", level_id: "5", grad_year: "2565" }),
    ];
    const localRows = [
      local({
        id: "uuid-1",
        studentId: "2", // primary snapshot = doctoral id
        contactEmail: "a@b.c",
        educations: [{ studentId: "2" }, { studentId: "1" }],
      }),
    ];
    // Searching by the LOWER-degree CMU id "1": the local row matches through
    // its education studentIds, the CMU side dedupes onto id 2, and the merge
    // bridges them via the student_ids set — one row, not two.
    const out = managePipeline(cmuRaw, localRows, { dedupeView: true, search: "1" });
    expect(out).toHaveLength(1);
    expect(out[0].contactEmail).toBe("a@b.c");
  });

  it("a soft-deleted local alumni hides the person entirely, CMU row included (net behavior of includeDeleted)", () => {
    const cmuRaw = [
      grad({ student_id: "9", level_id: "1", grad_year: "2560" }),
      grad({ student_id: "10", level_id: "1", grad_year: "2561", name_th: "อื่น" }),
    ];
    const localRows = [
      { ...local({ id: "uuid-del", studentId: "9" }), deletedAt: new Date().toISOString() },
    ];
    const out = managePipeline(cmuRaw, localRows, { dedupeView: true });
    // The deleted studentId hides BOTH the local row AND its CMU twin — this
    // is how the table "deletes" a CMU-backed person. Others survive.
    expect(out.map((r) => r.studentId)).toEqual(["10"]);
  });

  it("graduationYear facet agrees across BOTH sources (CMU string year vs local numeric year)", () => {
    const cmuRaw = [
      grad({ student_id: "1", level_id: "1", grad_year: "2560", name_th: "เอ", surname_th: "หนึ่ง" }),
      grad({ student_id: "2", level_id: "1", grad_year: "2562", name_th: "bee", surname_th: "two" }),
    ];
    const localRows = [
      local({ id: "uuid-3", studentId: "333", firstName: "see", lastName: "three", graduationYear: 2560 }),
    ];
    const out = managePipeline(cmuRaw, localRows, { dedupeView: true, graduationYears: ["2560"] });
    expect(out.map((r) => r.studentId).sort()).toEqual(["1", "333"]);
  });

  it("sorts the merged set with Thai collation (แ after ก, digits before letters)", () => {
    const cmuRaw = [
      grad({ student_id: "B2", name_th: "แดง", surname_th: "แสน", level_id: "1", grad_year: "2560" }),
      grad({ student_id: "B1", name_th: "ก้อง", surname_th: "เกิด", level_id: "1", grad_year: "2560" }),
    ];
    const out = managePipeline(cmuRaw, [], { dedupeView: true });
    // Default sort by studentId asc uses the Thai collator — "B1" < "B2".
    expect(out.map((r) => r.studentId)).toEqual(["B1", "B2"]);
    const byName = sortAlumni(out, "firstName", "asc");
    expect(byName.map((r) => r.firstName)).toEqual(["ก้อง", "แดง"]);
  });
});
