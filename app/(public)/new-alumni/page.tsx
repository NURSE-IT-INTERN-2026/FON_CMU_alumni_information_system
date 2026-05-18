"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PREFIX_OPTIONS, AWARD_TYPE_OPTIONS } from "@/lib/constants";

interface AwardRow {
  awardName: string;
  awardType: string;
  year: string;
  description: string;
}
interface AssociationRow {
  fullName: string;
  associationName: string;
  position: string;
  recordedYear: string;
}
interface CommitteeRow {
  termYear: string;
  fullName: string;
  cohort: string;
  position: string;
  remarks: string;
}
interface PotentialRow {
  fullName: string;
  career: string;
  position: string;
  recordedYear: string;
}
interface ModelRepRow {
  name: string;
  cohort: string;
  generation: string;
}
interface AbroadRow {
  name: string;
  address: string;
  country: string;
  university: string;
  order: string;
}

const EMPTY_ALUMNI = {
  studentId: "",
  prefix: "นางสาว",
  firstName: "",
  maidenLastName: "",
  cohort: "",
  newLastName: "",
  province: "",
};

export default function NewAlumniPage() {
  const router = useRouter();
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

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => {
      const next = !prev[key];
      if (next) {
        if (key === "associations" && associationRows.length === 0)
          setAssociationRows([{ fullName: "", associationName: "", position: "", recordedYear: "" }]);
        if (key === "committees" && committeeRows.length === 0)
          setCommitteeRows([{ termYear: "", fullName: "", cohort: "", position: "", remarks: "" }]);
        if (key === "potentials" && potentialRows.length === 0)
          setPotentialRows([{ fullName: "", career: "", position: "", recordedYear: "" }]);
        if (key === "modelReps" && modelRepRows.length === 0)
          setModelRepRows([{ name: "", cohort: "", generation: "" }]);
        if (key === "abroad" && abroadRows.length === 0)
          setAbroadRows([{ name: "", address: "", country: "", university: "", order: "" }]);
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
    if (!alumni.prefix) e.prefix = "กรุณาเลือกคำนำหน้า";
    if (!alumni.firstName.trim()) e.firstName = "กรุณากรอกชื่อ";
    if (!alumni.maidenLastName.trim())
      e.maidenLastName = "กรุณากรอกนามสกุลเดิม";
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
    };

    if (awardRows.length > 0) {
      payload.awards = awardRows.map((r) => ({
        awardName: r.awardName,
        awardType: r.awardType,
        year: Number(r.year),
        description: r.description || undefined,
      }));
    }
    if (associationRows.length > 0) {
      payload.associations = associationRows.map((r) => ({
        fullName: r.fullName || `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        associationName: r.associationName,
        position: r.position,
        recordedYear: Number(r.recordedYear),
      }));
    }
    if (committeeRows.length > 0) {
      payload.graduateCommittees = committeeRows.map((r) => ({
        termYear: Number(r.termYear),
        fullName: r.fullName || `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        cohort: r.cohort,
        position: r.position,
        remarks: r.remarks || undefined,
      }));
    }
    if (potentialRows.length > 0) {
      payload.potentials = potentialRows.map((r) => ({
        fullName: r.fullName || `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        career: r.career,
        position: r.position,
        recordedYear: Number(r.recordedYear),
      }));
    }
    if (modelRepRows.length > 0) {
      payload.modelRepresentatives = modelRepRows.map((r) => ({
        name: r.name || `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        cohort: r.cohort,
        generation: Number(r.generation),
      }));
    }
    if (abroadRows.length > 0) {
      payload.abroadAlumni = abroadRows.map((r) => ({
        name: r.name || `${alumni.prefix}${alumni.firstName} ${alumni.maidenLastName}`,
        address: r.address || undefined,
        country: r.country,
        university: r.university || undefined,
        order: Number(r.order) || 0,
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
              <select
                className={inputClass}
                value={alumni.prefix}
                onChange={(e) => updateAlumni("prefix", e.target.value)}
              >
                {PREFIX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
            fields={[
              { key: "awardName", label: "ชื่อรางวัล", required: true },
              {
                key: "awardType",
                label: "ประเภทรางวัล",
                type: "select",
                options: AWARD_TYPE_OPTIONS,
              },
              { key: "year", label: "ปี (พ.ศ.)", type: "number" },
              { key: "description", label: "รายละเอียด" },
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
            emptyRow={{ fullName: "", associationName: "", position: "", recordedYear: "" }}
            singleRow
            fields={[
              { key: "fullName", label: "ชื่อ-สกุล" },
              { key: "associationName", label: "ชื่อสมาคม/ชมรม", required: true },
              { key: "position", label: "ตำแหน่ง", required: true },
              { key: "recordedYear", label: "ปีที่บันทึก (พ.ศ.)", type: "number" },
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
            emptyRow={{ termYear: "", fullName: "", cohort: "", position: "", remarks: "" }}
            singleRow
            fields={[
              { key: "termYear", label: "ปี พ.ศ.", type: "number" },
              { key: "fullName", label: "ชื่อ-สกุล" },
              { key: "cohort", label: "รุ่นที่", required: true },
              { key: "position", label: "ตำแหน่ง", required: true },
              { key: "remarks", label: "หมายเหตุ" },
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
            emptyRow={{ fullName: "", career: "", position: "", recordedYear: "" }}
            singleRow
            fields={[
              { key: "fullName", label: "ชื่อ-สกุล" },
              { key: "career", label: "อาชีพ", required: true },
              { key: "position", label: "ตำแหน่ง", required: true },
              { key: "recordedYear", label: "ปีที่บันทึก (พ.ศ.)", type: "number" },
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
            emptyRow={{ name: "", cohort: "", generation: "" }}
            singleRow
            fields={[
              { key: "name", label: "ชื่อ-สกุล" },
              { key: "cohort", label: "รุ่น", required: true },
              { key: "generation", label: "ลำดับรุ่น", type: "number" },
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
            emptyRow={{ name: "", address: "", country: "", university: "", order: "" }}
            singleRow
            fields={[
              { key: "name", label: "ชื่อ-สกุล" },
              { key: "address", label: "ที่อยู่" },
              { key: "country", label: "ประเทศ", required: true },
              { key: "university", label: "มหาวิทยาลัย" },
              { key: "order", label: "ลำดับ", type: "number" },
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
  type?: "text" | "number" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
}

function RepeatableForm<T>({
  rows,
  setRows,
  emptyRow,
  fields,
  singleRow,
}: {
  rows: T[];
  setRows: React.Dispatch<React.SetStateAction<T[]>>;
  emptyRow: T;
  fields: FieldDef[];
  singleRow?: boolean;
}) {
  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";

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
                {f.label}
              </label>
              {f.type === "select" ? (
                <select
                  className={inputClass}
                  value={(row as Record<string, string>)[f.key]}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                >
                  {f.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputClass}
                  type={f.type || "text"}
                  value={(row as Record<string, string>)[f.key]}
                  onChange={(e) => updateRow(idx, f.key, e.target.value)}
                  placeholder={f.label}
                />
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
