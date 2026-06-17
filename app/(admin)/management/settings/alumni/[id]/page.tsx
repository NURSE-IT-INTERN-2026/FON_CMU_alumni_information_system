"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCanWrite } from "@/lib/role-context";
import { AWARD_TYPE_OPTIONS, DEGREE_LEVEL_OPTIONS, EDIT_REASON_OPTIONS, BASE_PATH } from "@/lib/constants";

interface AlumniData {
  id: string;
  studentId: string;
  prefix: string;
  firstName: string;
  maidenLastName: string;
  newLastName: string | null;
  cohort: string | null;
  degreeLevel: string;
  province: string | null;
  awards: {
    id: string;
    awardName: string;
    awardType: string;
    year: number;
    description: string | null;
  }[];
  associations: {
    id: string;
    associationName: string;
    position: string;
    recordedYear: number;
  }[];
  graduateCommittees: {
    id: string;
    termYear: number;
    cohort: string;
    position: string;
    remarks: string | null;
  }[];
  potentials: {
    id: string;
    career: string;
    position: string;
    recordedYear: number;
  }[];
  modelRepresentatives: {
    id: string;
    cohort: string;
    generation: number;
  }[];
}

interface AwardRow {
  awardName: string;
  awardType: string;
  year: string;
  description: string;
}
interface AssociationRow {
  associationName: string;
  position: string;
  recordedYear: string;
}
interface CommitteeRow {
  termYear: string;
  cohort: string;
  position: string;
  remarks: string;
}
interface PotentialRow {
  career: string;
  position: string;
  recordedYear: string;
}
interface ModelRepRow {
  cohort: string;
  generation: string;
}

export default function AlumniProfilePage() {
  const params = useParams();
  const router = useRouter();
  const canWrite = useCanWrite();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [editReason, setEditReason] = useState("");

  // Core alumni form
  const [alumni, setAlumni] = useState({
    prefix: "",
    firstName: "",
    maidenLastName: "",
    newLastName: "",
    cohort: "",
    degreeLevel: "",
    province: "",
  });
  const [originalAlumni, setOriginalAlumni] = useState(alumni);

  // Expandable sections
  const [sections, setSections] = useState({
    awards: false,
    associations: false,
    committees: false,
    potentials: false,
    modelReps: false,
  });

  const [awardRows, setAwardRows] = useState<AwardRow[]>([]);
  const [associationRows, setAssociationRows] = useState<AssociationRow[]>([]);
  const [committeeRows, setCommitteeRows] = useState<CommitteeRow[]>([]);
  const [potentialRows, setPotentialRows] = useState<PotentialRow[]>([]);
  const [modelRepRows, setModelRepRows] = useState<ModelRepRow[]>([]);

  // Store original section data for cancel
  const [origSections, setOrigSections] = useState(sections);
  const [origAwardRows, setOrigAwardRows] = useState<AwardRow[]>([]);
  const [origAssociationRows, setOrigAssociationRows] = useState<AssociationRow[]>([]);
  const [origCommitteeRows, setOrigCommitteeRows] = useState<CommitteeRow[]>([]);
  const [origPotentialRows, setOrigPotentialRows] = useState<PotentialRow[]>([]);
  const [origModelRepRows, setOrigModelRepRows] = useState<ModelRepRow[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchAlumni = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_PATH}/api/alumni/${id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: AlumniData = await res.json();

      const coreForm = {
        prefix: data.prefix || "",
        firstName: data.firstName || "",
        maidenLastName: data.maidenLastName || "",
        newLastName: data.newLastName || "",
        cohort: data.cohort || "",
        degreeLevel: data.degreeLevel || "",
        province: data.province || "",
      };
      setAlumni(coreForm);
      setOriginalAlumni(coreForm);

      // Map related data to form rows
      const aRows: AwardRow[] = (data.awards || []).map((a) => ({
        awardName: a.awardName,
        awardType: a.awardType,
        year: String(a.year),
        description: a.description || "",
      }));
      const asRows: AssociationRow[] = (data.associations || []).map((a) => ({
        associationName: a.associationName,
        position: a.position,
        recordedYear: String(a.recordedYear),
      }));
      const cRows: CommitteeRow[] = (data.graduateCommittees || []).map(
        (c) => ({
          termYear: String(c.termYear),
          cohort: c.cohort,
          position: c.position,
          remarks: c.remarks || "",
        })
      );
      const pRows: PotentialRow[] = (data.potentials || []).map((p) => ({
        career: p.career,
        position: p.position,
        recordedYear: String(p.recordedYear),
      }));
      const mRows: ModelRepRow[] = (data.modelRepresentatives || []).map(
        (m) => ({
          cohort: m.cohort,
          generation: String(m.generation),
        })
      );

      setAwardRows(aRows);
      setAssociationRows(asRows);
      setCommitteeRows(cRows);
      setPotentialRows(pRows);
      setModelRepRows(mRows);

      // Auto-expand sections that have data
      setSections({
        awards: aRows.length > 0,
        associations: asRows.length > 0,
        committees: cRows.length > 0,
        potentials: pRows.length > 0,
        modelReps: mRows.length > 0,
      });
    } catch {
      setErrorMsg("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const enterEditMode = () => {
    setEditMode(true);
    setErrorMsg("");
    setSuccessMsg("");
    setEditReason("");
    // Snapshot current state for cancel
    setOriginalAlumni({ ...alumni });
    setOrigSections({ ...sections });
    setOrigAwardRows(awardRows.map((r) => ({ ...r })));
    setOrigAssociationRows(associationRows.map((r) => ({ ...r })));
    setOrigCommitteeRows(committeeRows.map((r) => ({ ...r })));
    setOrigPotentialRows(potentialRows.map((r) => ({ ...r })));
    setOrigModelRepRows(modelRepRows.map((r) => ({ ...r })));
  };

  const cancelEdit = () => {
    setEditMode(false);
    setErrorMsg("");
    setEditReason("");
    setAlumni({ ...originalAlumni });
    setSections({ ...origSections });
    setAwardRows(origAwardRows.map((r) => ({ ...r })));
    setAssociationRows(origAssociationRows.map((r) => ({ ...r })));
    setCommitteeRows(origCommitteeRows.map((r) => ({ ...r })));
    setPotentialRows(origPotentialRows.map((r) => ({ ...r })));
    setModelRepRows(origModelRepRows.map((r) => ({ ...r })));
    setErrors({});
  };

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => {
      const next = !prev[key];
      if (next) {
        if (key === "awards" && awardRows.length === 0)
          setAwardRows([
            { awardName: "", awardType: "INTERNATIONAL", year: "", description: "" },
          ]);
        if (key === "associations" && associationRows.length === 0)
          setAssociationRows([{ associationName: "", position: "", recordedYear: "" }]);
        if (key === "committees" && committeeRows.length === 0)
          setCommitteeRows([{ termYear: "", cohort: "", position: "", remarks: "" }]);
        if (key === "potentials" && potentialRows.length === 0)
          setPotentialRows([{ career: "", position: "", recordedYear: "" }]);
        if (key === "modelReps" && modelRepRows.length === 0)
          setModelRepRows([{ cohort: "", generation: "" }]);
      }
      return { ...prev, [key]: next };
    });

  const updateAlumni = (field: string, value: string) => {
    setAlumni((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!alumni.prefix.trim()) e.prefix = "กรุณากรอกคำนำหน้า";
    if (!alumni.firstName.trim()) e.firstName = "กรุณากรอกชื่อ";
    if (!alumni.maidenLastName.trim())
      e.maidenLastName = "กรุณากรอกนามสกุลเดิม";
    if (!alumni.degreeLevel) e.degreeLevel = "กรุณาเลือกระดับการศึกษา";

    if (sections.awards) {
      awardRows.forEach((r, i) => {
        const prefix = `awards_${i}_`;
        if (!r.awardName.trim()) e[prefix + "awardName"] = "กรุณากรอกชื่อรางวัล";
        if (!r.awardType) e[prefix + "awardType"] = "กรุณาเลือกประเภทรางวัล";
        if (!r.year.trim()) e[prefix + "year"] = "กรุณากรอกปี";
        if (!r.description.trim()) e[prefix + "description"] = "กรุณากรอกรายละเอียด";
      });
    }
    if (sections.potentials) {
      potentialRows.forEach((r, i) => {
        const prefix = `potentials_${i}_`;
        if (!r.career.trim()) e[prefix + "career"] = "กรุณากรอกอาชีพ";
        if (!r.position.trim()) e[prefix + "position"] = "กรุณากรอกตำแหน่ง";
        if (!r.recordedYear.trim()) e[prefix + "recordedYear"] = "กรุณากรอกปีที่บันทึก";
      });
    }
    if (sections.associations) {
      associationRows.forEach((r, i) => {
        const prefix = `associations_${i}_`;
        if (!r.associationName.trim()) e[prefix + "associationName"] = "กรุณากรอกชื่อสมาคม/ชมรม";
        if (!r.position.trim()) e[prefix + "position"] = "กรุณากรอกตำแหน่ง";
        if (!r.recordedYear.trim()) e[prefix + "recordedYear"] = "กรุณากรอกปีที่บันทึก";
      });
    }
    if (sections.committees) {
      committeeRows.forEach((r, i) => {
        const prefix = `committees_${i}_`;
        if (!r.termYear.trim()) e[prefix + "termYear"] = "กรุณากรอกปี พ.ศ.";
        if (!r.cohort.trim()) e[prefix + "cohort"] = "กรุณากรอกรุ่นที่";
        if (!r.position.trim()) e[prefix + "position"] = "กรุณากรอกตำแหน่ง";
        if (!r.remarks.trim()) e[prefix + "remarks"] = "กรุณากรอกหมายเหตุ";
      });
    }
    if (sections.modelReps) {
      modelRepRows.forEach((r, i) => {
        const prefix = `modelReps_${i}_`;
        if (!r.cohort.trim()) e[prefix + "cohort"] = "กรุณากรอกรุ่น";
        if (!r.generation.trim()) e[prefix + "generation"] = "กรุณากรอกลำดับรุ่น";
      });
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!editReason) {
      setErrorMsg("กรุณาเลือกเหตุผลในการแก้ไข");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const payload: Record<string, unknown> = {
      reason: editReason,
      prefix: alumni.prefix,
      firstName: alumni.firstName.trim(),
      maidenLastName: alumni.maidenLastName.trim(),
      cohort: alumni.cohort.trim() || undefined,
      degreeLevel: alumni.degreeLevel,
      newLastName: alumni.newLastName.trim() || undefined,
      province: alumni.province.trim() || undefined,
    };

    if (sections.awards && awardRows.length > 0) {
      payload.awards = awardRows.map((r) => ({
        awardName: r.awardName,
        awardType: r.awardType,
        year: Number(r.year),
        description: r.description,
      }));
    }
    if (sections.associations && associationRows.length > 0) {
      payload.associations = associationRows.map((r) => ({
        associationName: r.associationName,
        position: r.position,
        recordedYear: Number(r.recordedYear),
      }));
    }
    if (sections.committees && committeeRows.length > 0) {
      payload.graduateCommittees = committeeRows.map((r) => ({
        termYear: Number(r.termYear),
        cohort: r.cohort,
        position: r.position,
        remarks: r.remarks,
      }));
    }
    if (sections.potentials && potentialRows.length > 0) {
      payload.potentials = potentialRows.map((r) => ({
        career: r.career,
        position: r.position,
        recordedYear: Number(r.recordedYear),
      }));
    }
    if (sections.modelReps && modelRepRows.length > 0) {
      payload.modelRepresentatives = modelRepRows.map((r) => ({
        cohort: r.cohort,
        generation: Number(r.generation),
      }));
    }

    try {
      const res = await fetch(`${BASE_PATH}/api/alumni/update-with-related/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }

      setSuccessMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
      setEditMode(false);
      setErrors({});
      // Re-fetch to get fresh data
      await fetchAlumni();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const btnPrimary =
    "bg-[var(--primary)] text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              กลับไปยังรายการ
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              ข้อมูลศิษย์เก่า
            </h1>
          </div>
          {!editMode && canWrite && (
            <button
              onClick={enterEditMode}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
            >
              แก้ไข
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {successMsg}
          </div>
        )}

        {/* Alumni Core Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            ข้อมูลศิษย์เก่า
          </h2>
          {editMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  คำนำหน้า <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={alumni.prefix}
                  onChange={(e) => updateAlumni("prefix", e.target.value)}
                  placeholder="คำนำหน้า"
                />
                {errors.prefix && (
                  <p className="text-red-500 text-xs mt-1">{errors.prefix}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>
                  ชื่อ <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={alumni.firstName}
                  onChange={(e) => updateAlumni("firstName", e.target.value)}
                  placeholder="ชื่อ"
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>
                  นามสกุล (เดิม) <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  value={alumni.maidenLastName}
                  onChange={(e) => updateAlumni("maidenLastName", e.target.value)}
                  placeholder="นามสกุลเดิม"
                />
                {errors.maidenLastName && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.maidenLastName}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>
                  ระดับการศึกษา <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputClass}
                  value={alumni.degreeLevel}
                  onChange={(e) => updateAlumni("degreeLevel", e.target.value)}
                >
                  <option value="">-- เลือกระดับการศึกษา --</option>
                  {DEGREE_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.degreeLevel && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.degreeLevel}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>รุ่น/สาขา</label>
                <input
                  className={inputClass}
                  value={alumni.cohort}
                  onChange={(e) => updateAlumni("cohort", e.target.value)}
                  placeholder="รุ่น/สาขา"
                />
              </div>
              <div>
                <label className={labelClass}>นามสกุล (ใหม่)</label>
                <input
                  className={inputClass}
                  value={alumni.newLastName}
                  onChange={(e) => updateAlumni("newLastName", e.target.value)}
                  placeholder="นามสกุลใหม่"
                />
              </div>
              <div>
                <label className={labelClass}>จังหวัด</label>
                <input
                  className={inputClass}
                  value={alumni.province}
                  onChange={(e) => updateAlumni("province", e.target.value)}
                  placeholder="จังหวัด"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoField label="คำนำหน้า" value={alumni.prefix} />
              <InfoField label="ชื่อ" value={alumni.firstName} />
              <InfoField label="นามสกุล (เดิม)" value={alumni.maidenLastName} />
              <InfoField label="นามสกุล (ใหม่)" value={alumni.newLastName} />
              <InfoField label="รุ่น/สาขา" value={alumni.cohort} />
              <InfoField
                label="ระดับการศึกษา"
                value={
                  DEGREE_LEVEL_OPTIONS.find((o) => o.value === alumni.degreeLevel)
                    ?.label || alumni.degreeLevel
                }
              />
              <InfoField label="จังหวัด" value={alumni.province} />
            </div>
          )}
        </div>

        {/* Expandable Sections */}
        <SectionToggle
          title="รางวัล"
          open={sections.awards}
          onToggle={() => toggleSection("awards")}
          readOnly={!editMode}
          count={awardRows.length}
        >
          {editMode ? (
            <RepeatableForm<AwardRow>
              rows={awardRows}
              setRows={setAwardRows}
              emptyRow={{
                awardName: "",
                awardType: "INTERNATIONAL",
                year: "",
                description: "",
              }}
              errors={errors}
              sectionKey="awards"
              fields={[
                { key: "awardName", label: "ชื่อรางวัล", required: true },
                {
                  key: "awardType",
                  label: "ประเภทรางวัล",
                  type: "select",
                  required: true,
                  options: AWARD_TYPE_OPTIONS,
                },
                {
                  key: "year",
                  label: "ปี (พ.ศ.)",
                  type: "number",
                  required: true,
                },
                {
                  key: "description",
                  label: "รายละเอียด",
                  type: "textarea",
                  required: true,
                },
              ]}
            />
          ) : (
            <ReadOnlyTable
              rows={awardRows}
              columns={[
                { key: "awardName", label: "ชื่อรางวัล" },
                {
                  key: "awardType",
                  label: "ประเภทรางวัล",
                  render: (v) =>
                    AWARD_TYPE_OPTIONS.find((o) => o.value === v)?.label || v,
                },
                { key: "year", label: "ปี (พ.ศ.)" },
                { key: "description", label: "รายละเอียด" },
              ]}
            />
          )}
        </SectionToggle>

        <SectionToggle
          title="สมาคม/ชมรม"
          open={sections.associations}
          onToggle={() => toggleSection("associations")}
          readOnly={!editMode}
          count={associationRows.length}
        >
          {editMode ? (
            <RepeatableForm<AssociationRow>
              rows={associationRows}
              setRows={setAssociationRows}
              emptyRow={{ associationName: "", position: "", recordedYear: "" }}
              errors={errors}
              sectionKey="associations"
              singleRow
              fields={[
                { key: "associationName", label: "ชื่อสมาคม/ชมรม", required: true },
                { key: "position", label: "ตำแหน่ง", required: true },
                {
                  key: "recordedYear",
                  label: "ปีที่บันทึก (พ.ศ.)",
                  type: "number",
                  required: true,
                },
              ]}
            />
          ) : (
            <ReadOnlyTable
              rows={associationRows}
              columns={[
                { key: "associationName", label: "ชื่อสมาคม/ชมรม" },
                { key: "position", label: "ตำแหน่ง" },
                { key: "recordedYear", label: "ปีที่บันทึก (พ.ศ.)" },
              ]}
            />
          )}
        </SectionToggle>

        <SectionToggle
          title="กรรมการบัณฑิต"
          open={sections.committees}
          onToggle={() => toggleSection("committees")}
          readOnly={!editMode}
          count={committeeRows.length}
        >
          {editMode ? (
            <RepeatableForm<CommitteeRow>
              rows={committeeRows}
              setRows={setCommitteeRows}
              emptyRow={{ termYear: "", cohort: "", position: "", remarks: "" }}
              errors={errors}
              sectionKey="committees"
              singleRow
              fields={[
                { key: "termYear", label: "ปี พ.ศ.", type: "number", required: true },
                { key: "cohort", label: "รุ่นที่", required: true },
                { key: "position", label: "ตำแหน่ง", required: true },
                { key: "remarks", label: "หมายเหตุ", type: "textarea", required: true },
              ]}
            />
          ) : (
            <ReadOnlyTable
              rows={committeeRows}
              columns={[
                { key: "termYear", label: "ปี พ.ศ." },
                { key: "cohort", label: "รุ่นที่" },
                { key: "position", label: "ตำแหน่ง" },
                { key: "remarks", label: "หมายเหตุ" },
              ]}
            />
          )}
        </SectionToggle>

        <SectionToggle
          title="ศักยภาพ"
          open={sections.potentials}
          onToggle={() => toggleSection("potentials")}
          readOnly={!editMode}
          count={potentialRows.length}
        >
          {editMode ? (
            <RepeatableForm<PotentialRow>
              rows={potentialRows}
              setRows={setPotentialRows}
              emptyRow={{ career: "", position: "", recordedYear: "" }}
              errors={errors}
              sectionKey="potentials"
              singleRow
              fields={[
                { key: "career", label: "อาชีพ", required: true },
                { key: "position", label: "ตำแหน่ง", required: true },
                {
                  key: "recordedYear",
                  label: "ปีที่บันทึก (พ.ศ.)",
                  type: "number",
                  required: true,
                },
              ]}
            />
          ) : (
            <ReadOnlyTable
              rows={potentialRows}
              columns={[
                { key: "career", label: "อาชีพ" },
                { key: "position", label: "ตำแหน่ง" },
                { key: "recordedYear", label: "ปีที่บันทึก (พ.ศ.)" },
              ]}
            />
          )}
        </SectionToggle>

        <SectionToggle
          title="ผู้แทนรุ่น"
          open={sections.modelReps}
          onToggle={() => toggleSection("modelReps")}
          readOnly={!editMode}
          count={modelRepRows.length}
        >
          {editMode ? (
            <RepeatableForm<ModelRepRow>
              rows={modelRepRows}
              setRows={setModelRepRows}
              emptyRow={{ cohort: "", generation: "" }}
              errors={errors}
              sectionKey="modelReps"
              singleRow
              fields={[
                { key: "cohort", label: "รุ่น", required: true },
                {
                  key: "generation",
                  label: "ลำดับรุ่น",
                  type: "number",
                  required: true,
                },
              ]}
            />
          ) : (
            <ReadOnlyTable
              rows={modelRepRows}
              columns={[
                { key: "cohort", label: "รุ่น" },
                { key: "generation", label: "ลำดับรุ่น" },
              ]}
            />
          )}
        </SectionToggle>

        {/* Action Buttons */}
        {editMode && (
          <div className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>
                เหตุผลในการแก้ไข <span className="text-red-500">*</span>
              </label>
              <select
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className={inputClass}
              >
                <option value="">— กรุณาเลือก —</option>
                {EDIT_REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelEdit}
                className="px-6 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            {canWrite && (
              <button
                onClick={handleSave}
                disabled={saving}
                className={btnPrimary}
              >
                {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </button>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Reusable Components ---

function SectionToggle({
  title,
  open,
  onToggle,
  children,
  readOnly,
  count,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  readOnly?: boolean;
  count?: number;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
              {count}
            </span>
          )}
        </span>
        <span className="text-gray-400 text-lg">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-6 pb-4">{children}</div>}
    </div>
  );
}

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  required?: boolean;
  options?: { value: string; label: string }[];
}

function RepeatableForm<T>({
  rows,
  setRows,
  emptyRow,
  fields,
  singleRow,
  errors,
  sectionKey,
}: {
  rows: T[];
  setRows: React.Dispatch<React.SetStateAction<T[]>>;
  emptyRow: T;
  fields: FieldDef[];
  singleRow?: boolean;
  errors?: Record<string, string>;
  sectionKey?: string;
}) {
  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const errorInputClass =
    "w-full border border-red-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent";

  const getFieldError = (idx: number, key: string) =>
    errors?.[`${sectionKey}_${idx}_${key}`];

  const addRow = () => setRows((prev) => [...prev, { ...emptyRow }]);
  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));
  const resetRow = (idx: number) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...emptyRow } : r)));
  const updateRow = (idx: number, key: string, value: string) =>
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );

  return (
    <div>
      {rows.map((row, idx) => (
        <div
          key={idx}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end mb-3 p-3 bg-gray-50 rounded-lg"
        >
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {f.label}{" "}
                {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.type === "select" ? (
                <select
                  className={
                    getFieldError(idx, f.key) ? errorInputClass : inputClass
                  }
                  value={(row as Record<string, string>)[f.key]}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                >
                  {f.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  className={
                    getFieldError(idx, f.key) ? errorInputClass : inputClass
                  }
                  rows={3}
                  value={(row as Record<string, string>)[f.key]}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                  placeholder={f.label}
                />
              ) : (
                <input
                  className={
                    getFieldError(idx, f.key) ? errorInputClass : inputClass
                  }
                  type={f.type || "text"}
                  value={(row as Record<string, string>)[f.key]}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                  placeholder={f.label}
                />
              )}
              {getFieldError(idx, f.key) && (
                <p className="text-red-500 text-xs mt-1">
                  {getFieldError(idx, f.key)}
                </p>
              )}
            </div>
          ))}
          <div className="flex items-end">
            <button
              onClick={() => (singleRow ? resetRow(idx) : removeRow(idx))}
              className="text-red-500 text-sm hover:text-red-700"
            >
              {singleRow ? "ล้างข้อมูล" : "ลบ"}
            </button>
          </div>
        </div>
      ))}
      {!singleRow && (
        <button
          onClick={addRow}
          className="text-sm text-[var(--primary)] font-medium hover:underline"
        >
          + เพิ่มข้อมูล
        </button>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReadOnlyTable({ rows, columns }: { rows: any[]; columns: { key: string; label: string; render?: (value: string) => string }[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-2">ไม่มีข้อมูล</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="py-2 px-3 text-left text-xs font-medium text-gray-500"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: Record<string, string>, idx: number) => (
            <tr key={idx} className="border-b border-gray-100 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="py-2 px-3 text-gray-700">
                  {col.render
                    ? col.render(row[col.key])
                    : row[col.key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--foreground)]">{value || "—"}</p>
    </div>
  );
}
