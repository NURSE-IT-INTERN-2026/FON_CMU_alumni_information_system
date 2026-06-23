import { describe, it, expect } from "vitest";
import { groupPersonsByDegree } from "../lib/person-degree-count";
import type { CmuGraduate } from "../lib/cmu-registrar";

const grad = (overrides: Partial<CmuGraduate>): CmuGraduate => ({
  student_id: "1",
  birthday: "01-12-2540",
  cmuitaccount: "",
  sex_id: "1",
  name_th: "สมหญิง",
  middle_name_th: "",
  surname_th: "รักเรียน",
  name_en: "",
  middle_name_en: "",
  surname_en: "",
  level_id: "1",
  faculty_id: "12",
  major_id: "",
  major_name_th: "",
  major_sub_name_th: "",
  curriculum_id: "",
  grad_date: "",
  grad_year: "2553",
  grad_semester: "",
  study_time_id: "",
  plan_id: "",
  plan_name_th: "",
  std_phone: "",
  std_mobile: "",
  grad_school: "",
  grad_province: "",
  grad_program: "",
  grad_gpa: "",
  adm_type: "",
  ...overrides,
});

describe("groupPersonsByDegree", () => {
  it("merges a person's multiple CMU degrees into their highest degree", () => {
    const persons = groupPersonsByDegree(
      [
        grad({ student_id: "B1", level_id: "1", grad_year: "2553" }), // BACHELOR
        grad({ student_id: "D1", level_id: "5", grad_year: "2566" }), // DOCTORAL
      ],
      [],
    );
    expect(persons).toHaveLength(1);
    expect(persons[0].degree).toBe("DOCTORAL");
    expect(persons[0].year).toBe(2566);
  });

  it("keeps distinct CMU people separate", () => {
    const persons = groupPersonsByDegree(
      [
        grad({ student_id: "1", level_id: "1", surname_th: "ก" }),
        grad({ student_id: "2", level_id: "5", surname_th: "ข" }),
      ],
      [],
    );
    expect(persons).toHaveLength(2);
  });

  it("bridges a local alumni to their CMU person via shared studentId", () => {
    // CMU knows only the bachelor record; the alumni locally adds a doctoral.
    const persons = groupPersonsByDegree(
      [grad({ student_id: "B1", level_id: "1", grad_year: "2553" })],
      [
        {
          alumniId: "A1",
          educations: [
            { studentId: "B1", degreeLevel: "BACHELOR", graduationYear: 2553 },
            { studentId: "D1", degreeLevel: "DOCTORAL", graduationYear: 2566 },
          ],
        },
      ],
    );
    expect(persons).toHaveLength(1); // CMU + local merged, not double-counted
    expect(persons[0].degree).toBe("DOCTORAL"); // locally-added higher degree wins
  });

  it("counts a local-only alumni (no CMU record) as their own person", () => {
    const persons = groupPersonsByDegree([], [
      {
        alumniId: "A1",
        educations: [{ studentId: "X1", degreeLevel: "MASTER", graduationYear: 2560 }],
      },
    ]);
    expect(persons).toHaveLength(1);
    expect(persons[0].degree).toBe("MASTER");
    expect(persons[0].year).toBe(2560);
  });

  it("keeps two distinct local alumni separate", () => {
    const persons = groupPersonsByDegree(
      [],
      [
        { alumniId: "A1", educations: [{ studentId: "X1", degreeLevel: "BACHELOR", graduationYear: 2553 }] },
        { alumniId: "A2", educations: [{ studentId: "X2", degreeLevel: "MASTER", graduationYear: 2560 }] },
      ],
    );
    expect(persons).toHaveLength(2);
  });

  it("picks the most recent year among the highest-degree records", () => {
    const persons = groupPersonsByDegree(
      [
        grad({ student_id: "D1", level_id: "5", grad_year: "2560" }),
        grad({ student_id: "D2", level_id: "5", grad_year: "2566" }),
      ],
      [],
    );
    expect(persons).toHaveLength(1);
    expect(persons[0].degree).toBe("DOCTORAL");
    expect(persons[0].year).toBe(2566);
  });

  it("handles empty input", () => {
    expect(groupPersonsByDegree([], [])).toEqual([]);
  });
});
