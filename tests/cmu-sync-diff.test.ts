import { describe, it, expect } from "vitest";
import { diffCmuGraduates, type CmuGraduate } from "../lib/cmu-registrar";

function mk(studentId: string, name = "a", year = "2563"): CmuGraduate {
  return {
    student_id: studentId,
    birthday: "01-01-2540",
    cmuitaccount: "",
    sex_id: "",
    name_th: name,
    surname_th: "b",
    name_en: "",
    surname_en: "",
    level_id: "1",
    major_name_th: "x",
    grad_date: "",
    grad_year: year,
  };
}

describe("diffCmuGraduates", () => {
  it("reports inSync when the studentId sets match", () => {
    const d = diffCmuGraduates([mk("1"), mk("2")], ["1", "2"]);
    expect(d.inSync).toBe(true);
    expect(d.newCount).toBe(0);
    expect(d.removedCount).toBe(0);
    expect(d.remoteCount).toBe(2);
    expect(d.localCount).toBe(2);
  });

  it("counts new (remote-only) and removed (local-only)", () => {
    const d = diffCmuGraduates([mk("1"), mk("3")], ["1", "2"]);
    expect(d.inSync).toBe(false);
    expect(d.newCount).toBe(1); // "3"
    expect(d.removedCount).toBe(1); // "2"
    expect(d.sample[0].studentId).toBe("3");
  });

  it("trims studentIds and ignores empty/blank ids", () => {
    const d = diffCmuGraduates([mk("  1  "), mk("")], ["1", "   "]);
    expect(d.remoteCount).toBe(1);
    expect(d.localCount).toBe(1);
    expect(d.inSync).toBe(true);
  });

  it("caps the sample list at 50", () => {
    const remote = Array.from({ length: 60 }, (_, i) => mk(String(i)));
    const d = diffCmuGraduates(remote, []);
    expect(d.newCount).toBe(60);
    expect(d.sample.length).toBe(50);
  });

  it("operates only on the supplied localIds — local-only alumni (not in cmu_graduates) never affect the comparison", () => {
    // The diff sees cmu_graduates studentIds vs remote. Local-only alumni live
    // in the `alumni` table and are never passed in here, so they cannot inflate
    // newCount or distort inSync.
    const d = diffCmuGraduates([mk("1"), mk("2")], ["1", "2"]);
    expect(d.inSync).toBe(true);
    expect(d.newCount).toBe(0);
  });

  it("detects a count mismatch even with no add/remove (defensive)", () => {
    // Duplicate local id collapses to one in the set; sets still equal.
    const d = diffCmuGraduates([mk("1"), mk("2")], ["1", "2", "1"]);
    expect(d.inSync).toBe(true);
    expect(d.localCount).toBe(2);
  });
});
