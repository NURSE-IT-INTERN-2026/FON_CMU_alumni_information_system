"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AWARD_TYPE_OPTIONS, DEGREE_LEVEL_OPTIONS } from "@/lib/constants";

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
interface AbroadRow {
  address: string;
  country: string;
  university: string;
}

const EMPTY_ALUMNI = {
  studentId: "",
  prefix: "",
  firstName: "",
  maidenLastName: "",
  cohort: "",
  newLastName: "",
  province: "",
  degreeLevel: "",
};

export default function NewAlumniPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLoadDone = useRef(false);
  const [alumni, setAlumni] = useState(EMPTY_ALUMNI);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Expandable sections
  const [sections, setSections] = useState({
    awards: false,
    associations: false,
    committees: false,
    potentials: false,
    modelReps: false,
    abroad: false,
  });

  const [awardRows, setAwardRows] = useState<AwardRow[]>([]);
  const [associationRows, setAssociationRows] = useState<AssociationRow[]>([]);
  const [committeeRows, setCommitteeRows] = useState<CommitteeRow[]>([]);
  const [potentialRows, setPotentialRows] = useState<PotentialRow[]>([]);
  const [modelRepRows, setModelRepRows] = useState<ModelRepRow[]>([]);
  const [abroadRows, setAbroadRows] = useState<AbroadRow[]>([]);

  // Pre-fill from query params (redirected from entity pages)
  useEffect(() => {
    if (initialLoadDone.current) return;

    const section = searchParams.get("section");
    const nameSearch = searchParams.get("nameSearch");
    const firstName = searchParams.get("firstName");
    const maidenLastName = searchParams.get("maidenLastName");
    const prefix = searchParams.get("prefix");

    if (!section && !nameSearch && !firstName && !maidenLastName) return;

    initialLoadDone.current = true;

    if (nameSearch) setAlumni((prev) => ({ ...prev, firstName: nameSearch }));
    if (firstName) setAlumni((prev) => ({ ...prev, firstName }));
    if (maidenLastName) setAlumni((prev) => ({ ...prev, maidenLastName }));
    if (prefix) setAlumni((prev) => ({ ...prev, prefix }));

    const validSections = ["awards", "associations", "committees", "potentials", "modelReps", "abroad"];
    if (section && validSections.includes(section)) {
      setSections((prev) => ({ ...prev, [section]: true }));

      switch (section) {
        case "awards": {
          const row: AwardRow = {
            awardName: searchParams.get("awardName") || "",
            awardType: searchParams.get("awardType") || "INTERNATIONAL",
            year: searchParams.get("year") || "",
            description: searchParams.get("description") || "",
          };
          if (row.awardName || row.year) setAwardRows([row]);
          break;
        }
        case "associations": {
          const row: AssociationRow = {
            associationName: searchParams.get("associationName") || "",
            position: searchParams.get("position") || "",
            recordedYear: searchParams.get("recordedYear") || "",
          };
          if (row.associationName) setAssociationRows([row]);
          break;
        }
        case "committees": {
          const row: CommitteeRow = {
            termYear: searchParams.get("termYear") || "",
            cohort: searchParams.get("cohort") || "",
            position: searchParams.get("position") || "",
            remarks: searchParams.get("remarks") || "",
          };
          if (row.termYear || row.cohort) setCommitteeRows([row]);
          break;
        }
        case "potentials": {
          const row: PotentialRow = {
            career: searchParams.get("career") || "",
            position: searchParams.get("position") || "",
            recordedYear: searchParams.get("recordedYear") || "",
          };
          if (row.career) setPotentialRows([row]);
          break;
        }
        case "modelReps": {
          const row: ModelRepRow = {
            cohort: searchParams.get("cohort") || "",
            generation: searchParams.get("generation") || "",
          };
          if (row.cohort) setModelRepRows([row]);
          break;
        }
        case "abroad": {
          const row: AbroadRow = {
            address: searchParams.get("address") || "",
            country: searchParams.get("country") || "",
            university: searchParams.get("university") || "",
          };
          if (row.address || row.country) setAbroadRows([row]);
          break;
        }
      }
    }
  }, [searchParams]);

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => {
      const next = !prev[key];
      if (next) {
        if (key === "associations" && associationRows.length === 0)
          setAssociationRows([{ associationName: "", position: "", recordedYear: "" }]);
        if (key === "committees" && committeeRows.length === 0)
          setCommitteeRows([{ termYear: "", cohort: "", position: "", remarks: "" }]);
        if (key === "potentials" && potentialRows.length === 0)
          setPotentialRows([{ career: "", position: "", recordedYear: "" }]);
        if (key === "modelReps" && modelRepRows.length === 0)
          setModelRepRows([{ cohort: "", generation: "" }]);
        if (key === "abroad" && abroadRows.length === 0)
          setAbroadRows([{ address: "", country: "", university: "" }]);
      }
      return { ...prev, [key]: next };
    });

  const updateAlumni = (field: string, value: string) => {
    setAlumni((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!alumni.studentId.trim()) e.studentId = "กรุณากรอกรหัสนักศึกษา";
    else if (!/^\d+$/.test(alumni.studentId.trim())) e.studentId = "รหัสนักศึกษาต้องเป็นตัวเลขเท่านั้น";
    if (!alumni.prefix.trim()) e.prefix = "กรุณากรอกคำนำหน้า";
    if (!alumni.firstName.trim()) e.firstName = "กรุณากรอกชื่อ";
    if (!alumni.maidenLastName.trim())
      e.maidenLastName = "กรุณากรอกนามสกุลเดิม";
    if (!alumni.degreeLevel) e.degreeLevel = "กรุณาเลือกระดับการศึกษา";

    // Validate expanded sections — all fields required when section is open
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
    if (sections.abroad) {
      abroadRows.forEach((r, i) => {
        const prefix = `abroad_${i}_`;
        if (!r.address.trim()) e[prefix + "address"] = "กรุณากรอกที่อยู่";
        if (!r.country.trim()) e[prefix + "country"] = "กรุณากรอกประเทศ";
        if (!r.university.trim()) e[prefix + "university"] = "กรุณากรอกมหาวิทยาลัย";
      });
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    setErrorMsg("");

    const payload: Record<string, unknown> = {
      studentId: alumni.studentId.trim(),
      prefix: alumni.prefix,
      firstName: alumni.firstName.trim(),
      maidenLastName: alumni.maidenLastName.trim(),
      cohort: alumni.cohort.trim() || undefined,
      newLastName: alumni.newLastName.trim() || undefined,
      province: alumni.province.trim() || undefined,
      degreeLevel: alumni.degreeLevel,
    };

    if (awardRows.length > 0) {
      payload.awards = awardRows.map((r) => ({
        awardName: r.awardName,
        awardType: r.awardType,
        year: Number(r.year),
        description: r.description,
      }));
    }
    if (associationRows.length > 0) {
      payload.associations = associationRows.map((r) => ({
        fullName: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        associationName: r.associationName,
        position: r.position,
        recordedYear: Number(r.recordedYear),
      }));
    }
    if (committeeRows.length > 0) {
      payload.graduateCommittees = committeeRows.map((r) => ({
        termYear: Number(r.termYear),
        fullName: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        cohort: r.cohort,
        position: r.position,
        remarks: r.remarks,
      }));
    }
    if (potentialRows.length > 0) {
      payload.potentials = potentialRows.map((r) => ({
        fullName: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        career: r.career,
        position: r.position,
        recordedYear: Number(r.recordedYear),
      }));
    }
    if (modelRepRows.length > 0) {
      payload.modelRepresentatives = modelRepRows.map((r) => ({
        name: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        cohort: r.cohort,
        generation: Number(r.generation),
      }));
    }
    if (abroadRows.length > 0) {
      payload.abroadAlumni = abroadRows.map((r) => ({
        name: `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        address: r.address,
        country: r.country,
        university: r.university,
      }));
    }

    try {
      const res = await fetch("/api/alumni/create-with-related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setSuccessMsg("บันทึกข้อมูลศิษย์เก่าเรียบร้อยแล้ว");
      setAlumni(EMPTY_ALUMNI);
      setAwardRows([]);
      setAssociationRows([]);
      setCommitteeRows([]);
      setPotentialRows([]);
      setModelRepRows([]);
      setAbroadRows([]);
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const btnPrimary =
    "bg-[var(--primary)] text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50";
  const btnOutline =
    "border border-[var(--primary)] text-[var(--primary)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--primary)] hover:text-white";

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            เพิ่มข้อมูลศิษย์เก่า
          </h1>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; กลับ
          </button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                รหัสนักศึกษา <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={alumni.studentId}
                onChange={(e) => updateAlumni("studentId", e.target.value)}
                placeholder="รหัสนักศึกษา"
              />
              {errors.studentId && (
                <p className="text-red-500 text-xs mt-1">{errors.studentId}</p>
              )}
            </div>
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
                onChange={(e) =>
                  updateAlumni("maidenLastName", e.target.value)
                }
                placeholder="นามสกุลเดิม"
              />
              {errors.maidenLastName && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.maidenLastName}
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
              <label className={labelClass}>ระดับการศึกษา <span className="text-red-500">*</span></label>
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
                <p className="text-red-500 text-xs mt-1">{errors.degreeLevel}</p>
              )}
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
        </div>

        {/* Expandable Sections */}
        <SectionToggle
          title="รางวัล"
          open={sections.awards}
          onToggle={() => toggleSection("awards")}
        >
          <RepeatableForm<AwardRow>
            rows={awardRows}
            setRows={setAwardRows}
            emptyRow={{ awardName: "", awardType: "INTERNATIONAL", year: "", description: "" }}
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
              { key: "year", label: "ปี (พ.ศ.)", type: "number", required: true },
              { key: "description", label: "รายละเอียด", type: "textarea", required: true },
            ]}
          />
        </SectionToggle>

        <SectionToggle
          title="สมาคม/ชมรม"
          open={sections.associations}
          onToggle={() => toggleSection("associations")}
        >
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
              { key: "recordedYear", label: "ปีที่บันทึก (พ.ศ.)", type: "number", required: true },
            ]}
          />
        </SectionToggle>

        <SectionToggle
          title="กรรมการบัณฑิต"
          open={sections.committees}
          onToggle={() => toggleSection("committees")}
        >
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
        </SectionToggle>

        <SectionToggle
          title="ศักยภาพ"
          open={sections.potentials}
          onToggle={() => toggleSection("potentials")}
        >
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
              { key: "recordedYear", label: "ปีที่บันทึก (พ.ศ.)", type: "number", required: true },
            ]}
          />
        </SectionToggle>

        <SectionToggle
          title="ผู้แทนรุ่น"
          open={sections.modelReps}
          onToggle={() => toggleSection("modelReps")}
        >
          <RepeatableForm<ModelRepRow>
            rows={modelRepRows}
            setRows={setModelRepRows}
            emptyRow={{ cohort: "", generation: "" }}
            errors={errors}
            sectionKey="modelReps"
            singleRow
            fields={[
              { key: "cohort", label: "รุ่น", required: true },
              { key: "generation", label: "ลำดับรุ่น", type: "number", required: true },
            ]}
          />
        </SectionToggle>

        <SectionToggle
          title="ข้อมูลการทำงานต่างประเทศ"
          open={sections.abroad}
          onToggle={() => toggleSection("abroad")}
        >
          <RepeatableForm<AbroadRow>
            rows={abroadRows}
            setRows={setAbroadRows}
            emptyRow={{ address: "", country: "", university: "" }}
            errors={errors}
            sectionKey="abroad"
            singleRow
            fields={[
              { key: "address", label: "ที่อยู่", required: true },
              { key: "country", label: "ประเทศ", required: true },
              { key: "university", label: "มหาวิทยาลัย", required: true },
            ]}
          />
        </SectionToggle>

        {/* Submit */}
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={btnPrimary}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </button>
        </div>
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
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className="text-gray-400 text-lg">
          {open ? "▲" : "▼"}
        </span>
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
          className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-3 p-3 bg-gray-50 rounded-lg"
        >
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.type === "select" ? (
                <select
                  className={getFieldError(idx, f.key) ? errorInputClass : inputClass}
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
                  className={getFieldError(idx, f.key) ? errorInputClass : inputClass}
                  rows={3}
                  value={(row as Record<string, string>)[f.key]}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                  placeholder={f.label}
                />
              ) : (
                <input
                  className={getFieldError(idx, f.key) ? errorInputClass : inputClass}
                  type={f.type || "text"}
                  value={(row as Record<string, string>)[f.key]}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                  placeholder={f.label}
                />
              )}
              {getFieldError(idx, f.key) && (
                <p className="text-red-500 text-xs mt-1">{getFieldError(idx, f.key)}</p>
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
