import { describe, expect, it } from "vitest";
import { mergeAlumniTableRows, type CmuAlumniInput, type LocalAlumniInput } from "@/lib/alumni-merge";

/** Minimal factory for a CMU row (only the fields the merge reads). */
const cmu = (over: Partial<CmuAlumniInput>): CmuAlumniInput => ({
  student_id: "111",
  name_th: "สมชาย",
  surname_th: "ใจดี",
  level_id: "1",
  grad_year: "2560",
  major_name_th: "พยาบาลศาสตร์",
  birthday: "01-12-1997",
  ...over,
});

/** Minimal factory for a local alumni row. Fields mirror the page's `Alumni`. */
const local = (over: Partial<LocalAlumniInput> & { id: string; studentId: string }): LocalAlumniInput => ({
  prefix: "นาย",
  firstName: "สมชาย",
  lastName: "ใจดี",
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

describe("mergeAlumniTableRows", () => {
  it("renders a CMU-only row (dedupe on) with CMU identity + derived cohort, null degree level", () => {
    const merged = mergeAlumniTableRows(
      [cmu({ student_id: "111", level_id: "1", grad_year: "2560", birthday: "01-12-1997" })],
      [],
      { dedupeView: true, search: "" },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "111",
      studentId: "111",
      prefix: "",
      firstName: "สมชาย",
      lastName: "ใจดี",
      // Dedupe mode keeps the degree level on the CMU side (not translated).
      degreeLevel: null,
      major: "พยาบาลศาสตร์",
      graduationYear: 2560,
      birthDate: "1997-12-01",
      cohort: "DN57", // 2560 - 3 = 2557 → "DN57"
      email: null,
      contactEmail: null,
    });
  });

  it("translates the degree level for a CMU-only row in show-all mode (dedupe off)", () => {
    const merged = mergeAlumniTableRows(
      [cmu({ student_id: "111", level_id: "1", grad_year: "2560" })],
      [],
      { dedupeView: false, search: "" },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].degreeLevel).toBe("BACHELOR");
  });

  it("overlays local identity/contact onto a matching CMU row, and does not duplicate it", () => {
    const merged = mergeAlumniTableRows(
      [cmu({ student_id: "222", student_ids: ["222"], level_id: "3", grad_year: "2562", major_name_th: "ผดุงครรภ์", birthday: "02-02-1990" })],
      [local({ id: "uuid-2", studentId: "222", prefix: "นาง", firstName: "มาลี", lastName: "รักไทย", cohort: "รุ่น 5", degreeLevel: "MASTER", contactEmail: "c@y", phones: ["081"] })],
      { dedupeView: true, search: "" },
    );
    expect(merged).toHaveLength(1);
    // Local identity + contact preserved; CMU birthday overlays the local one.
    expect(merged[0]).toMatchObject({
      id: "uuid-2",
      studentId: "222",
      prefix: "นาง",
      firstName: "มาลี",
      degreeLevel: "MASTER", // NOT overridden in dedupe mode
      contactEmail: "c@y",
      phones: ["081"],
      birthDate: "1990-02-02",
      cohort: "รุ่น 5",
    });
  });

  it("overrides degree fields from the CMU record in show-all mode (dedupe off)", () => {
    // The alumni carries its primary education (every active alumni has ≥1,
    // per the creation-path invariant) — without it the show-all local-only
    // fallback would also emit the snapshot, duplicating the CMU overlay.
    const merged = mergeAlumniTableRows(
      [cmu({ student_id: "222", student_ids: ["222"], level_id: "3", grad_year: "2562", major_name_th: "ผดุงครรภ์" })],
      [local({ id: "uuid-2", studentId: "222", cohort: "รุ่น 5", degreeLevel: "MASTER", major: "เก่า", educations: [
        { studentId: "222", degreeLevel: "MASTER", graduationYear: 2562, major: null, cohort: null },
      ] })],
      { dedupeView: false, search: "" },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "uuid-2",
      studentId: "222",
      degreeLevel: "MASTER", // cmuLevelToDegree("3") = MASTER
      major: "ผดุงครรภ์", // CMU overrides local
      graduationYear: 2562,
      cohort: "รุ่น 5",
    });
  });

  it("bridges a CMU person to a local alumni via a non-primary education studentId (multi-degree collapse)", () => {
    // CMU kept record is the doctoral one (student_id 333), but the local
    // alumni's PRIMARY snapshot is 444 — it holds 333 only as an education.
    const merged = mergeAlumniTableRows(
      [cmu({ student_id: "333", student_ids: ["333", "444"], level_id: "5", grad_year: "2565", name_th: "ปกรณ์" })],
      [local({ id: "uuid-3", studentId: "444", firstName: "ปกรณ์", educations: [
        { studentId: "444", degreeLevel: "BACHELOR", graduationYear: 2557, major: null, cohort: null },
        { studentId: "333", degreeLevel: "DOCTORAL", graduationYear: 2565, major: null, cohort: null },
      ] })],
      { dedupeView: true, search: "" },
    );
    expect(merged).toHaveLength(1);
    // One row, the local alumni overlaid on the CMU person (not duplicated).
    expect(merged[0].id).toBe("uuid-3");
  });

  it("appends a local-only alumni whose studentId is not in CMU", () => {
    const merged = mergeAlumniTableRows(
      [cmu({ student_id: "555" })],
      [local({ id: "uuid-5", studentId: "666", firstName: "local-only", degreeLevel: "BACHELOR", graduationYear: 2560 })],
      { dedupeView: true, search: "" },
    );
    expect(merged).toHaveLength(2);
    const only = merged.find((m) => m.id === "uuid-5");
    expect(only).toMatchObject({ id: "uuid-5", studentId: "666", firstName: "local-only", cohort: "DN57" });
  });

  it("skips soft-deleted local alumni and the CMU rows for their studentId", () => {
    const merged = mergeAlumniTableRows(
      [cmu({ student_id: "777" })],
      [local({ id: "uuid-7", studentId: "777", deletedAt: "2026-01-01T00:00:00.000Z" })],
      { dedupeView: true, search: "" },
    );
    expect(merged).toHaveLength(0);
  });

  it("in show-all mode expands a local alumni into one row per education not in CMU", () => {
    const merged = mergeAlumniTableRows(
      [],
      [local({ id: "uuid-8", studentId: "888", educations: [
        { studentId: "E1", degreeLevel: "MASTER", graduationYear: 2562, major: null, cohort: null },
        { studentId: "E2", degreeLevel: "DOCTORAL", graduationYear: 2565, major: null, cohort: null },
      ] })],
      { dedupeView: false, search: "" },
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.studentId).sort()).toEqual(["E1", "E2"]);
  });

  it("in show-all mode with a search term keeps only the matching degree row", () => {
    const merged = mergeAlumniTableRows(
      [],
      [local({ id: "uuid-8", studentId: "888", firstName: "ค้นหา", educations: [
        { studentId: "E1", degreeLevel: "MASTER", graduationYear: 2562, major: null, cohort: null },
        { studentId: "E2", degreeLevel: "DOCTORAL", graduationYear: 2565, major: null, cohort: null },
      ] })],
      { dedupeView: false, search: "E2" },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ studentId: "E2", degreeLevel: "DOCTORAL" });
  });
});
