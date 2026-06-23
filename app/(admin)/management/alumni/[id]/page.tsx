"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AWARD_TYPE_OPTIONS,
  AWARD_TYPE_LABELS,
  DEGREE_LEVEL_OPTIONS,
  PREFIX_OPTIONS,
  EDIT_REASON_OPTIONS,
} from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useCanWrite } from "@/lib/role-context";
import {
  alumniProfileWithRelatedFormSchema,
  type AlumniProfileWithRelatedFormData,
} from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";
import SectionToggle from "@/components/form/SectionToggle";
import RepeatableFieldArray, { type FieldDef } from "@/components/form/RepeatableFieldArray";
import OrangeCell from "@/components/OrangeCell";
import { useHotFields } from "@/lib/use-hot-fields";
import AlumniActivityTimeline from "@/components/AlumniActivityTimeline";

// Admin alumni profile view (PRD §3.18). Mirrors the alumni-portal profile
// layout (Basic / Contact / Work + Related sections), with edited core fields
// highlighted orange (click → edit-history modal), an Edit mode, and a toggle
// to a merged "data logs" timeline. Reached by clicking a row on any
// alumni-related table; the route param accepts the alumni UUID or studentId.

interface AwardData {
  id: string;
  awardName: string;
  awardType: string;
  year: number;
  description: string | null;
}
interface AssociationData {
  id: string;
  associationName: string;
  position: string;
  recordedYear: number;
}
interface CommitteeData {
  id: string;
  termYear: number;
  cohort: string;
  position: string;
  remarks: string | null;
}
interface PotentialData {
  id: string;
  career: string;
  position: string;
  recordedYear: number;
}
interface ModelRepData {
  id: string;
  cohort: string;
  generation: number;
}
interface AgencyData {
  id: string;
  country: string;
  workplace: string | null;
  homeAddress: string | null;
  notes: string | null;
}

interface AlumniData {
  id: string;
  studentId: string;
  citizenId: string | null;
  birthDate: string | null;
  prefix: string;
  firstName: string;
  maidenLastName: string;
  newLastName: string | null;
  cohort: string | null;
  degreeLevel: string;
  province: string | null;
  email: string | null;
  phone: string | null;
  currentWorkplace: string | null;
  country: string | null;
  awards?: AwardData[];
  associations?: AssociationData[];
  graduateCommittees?: CommitteeData[];
  potentials?: PotentialData[];
  modelRepresentatives?: ModelRepData[];
  alumniAgency?: AgencyData[];
}

const DEGREE_LABELS: Record<string, string> = Object.fromEntries(
  DEGREE_LEVEL_OPTIONS.map((o) => [o.value, o.label])
);

const AUTH_INPUT_CLASS = "px-4 py-2.5 text-[var(--foreground)] border-[var(--border)]";
const AUTH_LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--foreground)]";

// Alumni core fields are tracked under BOTH "alumni" (admin edits) and
// "alumni_profile" (alumni self-edits) — query both so an orange indicator and
// its modal cover changes from either actor.
const ALUMNI_RESOURCE_TYPES: string[] = ["alumni", "alumni_profile"];

const AWARD_FIELDS: FieldDef[] = [
  { key: "awardName", label: "ชื่อรางวัล", required: true },
  { key: "awardType", label: "ประเภทรางวัล", type: "select", required: true, options: AWARD_TYPE_OPTIONS },
  { key: "year", label: "ปี (พ.ศ.)", type: "number", required: true },
  { key: "description", label: "รายละเอียด", type: "textarea", required: true },
];
const ASSOCIATION_FIELDS: FieldDef[] = [
  { key: "associationName", label: "ชื่อสมาคม/ชมรม", required: true },
  { key: "position", label: "ตำแหน่ง", required: true },
  { key: "recordedYear", label: "ปีที่บันทึก (พ.ศ.)", type: "number", required: true },
];
const COMMITTEE_FIELDS: FieldDef[] = [
  { key: "termYear", label: "ปี พ.ศ.", type: "number", required: true },
  { key: "cohort", label: "รุ่นที่", required: true },
  { key: "position", label: "ตำแหน่ง", required: true },
  { key: "remarks", label: "หมายเหตุ", type: "textarea", required: true },
];
const POTENTIAL_FIELDS: FieldDef[] = [
  { key: "career", label: "อาชีพ", required: true },
  { key: "position", label: "ตำแหน่ง", required: true },
  { key: "recordedYear", label: "ปีที่บันทึก (พ.ศ.)", type: "number", required: true },
];
const MODEL_REP_FIELDS: FieldDef[] = [
  { key: "cohort", label: "รุ่น", required: true },
  { key: "generation", label: "ลำดับรุ่น", type: "number", required: true },
];

function buildFormValues(data: AlumniData): AlumniProfileWithRelatedFormData {
  return {
    prefix: data.prefix || "",
    firstName: data.firstName || "",
    maidenLastName: data.maidenLastName || "",
    newLastName: data.newLastName || "",
    cohort: data.cohort || "",
    degreeLevel: data.degreeLevel || "",
    province: data.province || "",
    email: data.email || "",
    phone: data.phone || "",
    currentWorkplace: data.currentWorkplace || "",
    country: data.country || "",
    awards: (data.awards || []).map((a) => ({
      awardName: a.awardName,
      awardType: a.awardType as "INTERNATIONAL" | "NATIONAL" | "LOCAL",
      year: String(a.year),
      description: a.description || "",
    })),
    associations: (data.associations || []).map((a) => ({
      associationName: a.associationName,
      position: a.position,
      recordedYear: String(a.recordedYear),
    })),
    graduateCommittees: (data.graduateCommittees || []).map((c) => ({
      termYear: String(c.termYear),
      cohort: c.cohort,
      position: c.position,
      remarks: c.remarks || "",
    })),
    potentials: (data.potentials || []).map((p) => ({
      career: p.career,
      position: p.position,
      recordedYear: String(p.recordedYear),
    })),
    modelRepresentatives: (data.modelRepresentatives || []).map((m) => ({
      cohort: m.cohort,
      generation: String(m.generation),
    })),
    alumniAgency: [],
  };
}

function sectionsFromData(data: AlumniData) {
  return {
    awards: (data.awards?.length ?? 0) > 0,
    associations: (data.associations?.length ?? 0) > 0,
    committees: (data.graduateCommittees?.length ?? 0) > 0,
    potentials: (data.potentials?.length ?? 0) > 0,
    modelReps: (data.modelRepresentatives?.length ?? 0) > 0,
  };
}

export default function AdminAlumniProfilePage() {
  const params = useParams();
  const router = useRouter();
  const canWrite = useCanWrite();
  const id = params.id as string;

  const [tab, setTab] = useState<"profile" | "logs">("profile");
  const [editMode, setEditMode] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [sections, setSections] = useState({
    awards: false,
    associations: false,
    committees: false,
    potentials: false,
    modelReps: false,
  });

  const {
    register,
    handleSubmit,
    control,
    reset: formReset,
    formState: { errors },
  } = useForm<AlumniProfileWithRelatedFormData>({
    resolver: zodResolver(alumniProfileWithRelatedFormSchema) as unknown as Resolver<AlumniProfileWithRelatedFormData>,
    defaultValues: {
      prefix: "", firstName: "", maidenLastName: "", newLastName: "", cohort: "",
      degreeLevel: "", province: "", email: "", phone: "", currentWorkplace: "",
      country: "", awards: [], associations: [], graduateCommittees: [],
      potentials: [], modelRepresentatives: [], alumniAgency: [],
    },
  });

  const qc = useQueryClient();
  const { data: alumni, isPending: loading, error } = useQuery({
    queryKey: queryKeys.alumniProfile.admin(id),
    queryFn: () => apiFetch<AlumniData>(`/api/alumni/${id}`),
  });

  // Hot fields across both tracking scopes for the orange indicators.
  const hotMap = useHotFields(
    ALUMNI_RESOURCE_TYPES.join(","),
    alumni ? [alumni.id] : [],
  );
  const hot = alumni ? hotMap[alumni.id] ?? [] : [];

  // Populate the form whenever the fetched record changes (initial load +
  // post-save refetch). Skipped while editing so in-progress edits aren't
  // clobbered by a background refetch.
  /* eslint-disable react-hooks/set-state-in-effect -- populating react-hook-form + section state from the fetched record is inherently a data->state sync */
  useEffect(() => {
    if (!alumni || editMode) return;
    formReset(buildFormValues(alumni));
    setSections(sectionsFromData(alumni));
  }, [alumni, editMode, formReset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  async function handleSave(data: AlumniProfileWithRelatedFormData) {
    if (!alumni) return;
    setErrorMsg("");
    setSuccessMsg("");
    if (!editReason) {
      setErrorMsg("กรุณาเลือกเหตุผลในการแก้ไข");
      return;
    }
    setSaving(true);

    // update-with-related persists core + 5 related sections (it does NOT
    // handle alumniAgency), so alumniAgency is intentionally omitted here.
    const payload: Record<string, unknown> = {
      reason: editReason,
      prefix: data.prefix,
      firstName: data.firstName.trim(),
      maidenLastName: data.maidenLastName.trim(),
      newLastName: data.newLastName?.trim() || "",
      cohort: data.cohort?.trim() || "",
      degreeLevel: data.degreeLevel,
      province: data.province?.trim() || "",
      email: data.email?.trim() || "",
      phone: data.phone?.trim() || "",
      currentWorkplace: data.currentWorkplace?.trim() || "",
      country: data.country?.trim() || "",
      awards: (data.awards || []).map((a) => ({
        awardName: a.awardName,
        awardType: a.awardType,
        year: Number(a.year),
        description: a.description,
      })),
      associations: (data.associations || []).map((a) => ({
        associationName: a.associationName,
        position: a.position,
        recordedYear: Number(a.recordedYear),
      })),
      graduateCommittees: (data.graduateCommittees || []).map((g) => ({
        termYear: Number(g.termYear),
        cohort: g.cohort,
        position: g.position,
        remarks: g.remarks,
      })),
      potentials: (data.potentials || []).map((p) => ({
        career: p.career,
        position: p.position,
        recordedYear: Number(p.recordedYear),
      })),
      modelRepresentatives: (data.modelRepresentatives || []).map((m) => ({
        cohort: m.cohort,
        generation: Number(m.generation),
      })),
    };

    try {
      await apiFetch(`/api/alumni/update-with-related/${alumni.id}`, { method: "PUT", json: payload });
      setEditMode(false);
      setSuccessMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
      // Invalidate so the record refetches with the full include (the PUT
      // response omits alumniAgency) and orange indicators refresh.
      qc.invalidateQueries({ queryKey: queryKeys.alumniProfile.admin(id) });
      qc.invalidateQueries({ queryKey: queryKeys.alumniProfile.activity(alumni.id) });
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e) {
      setErrorMsg(e instanceof ApiError ? e.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditMode(false);
    setErrorMsg("");
    if (alumni) {
      formReset(buildFormValues(alumni));
      setSections(sectionsFromData(alumni));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error || !alumni) {
    return (
      <div className="py-20 text-center">
        <p className="text-[var(--danger)]">{errorMsg || "ไม่พบข้อมูลศิษย์เก่า"}</p>
      </div>
    );
  }

  const showTabs = !editMode;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            onClick={() => router.back()}
            className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            กลับ
          </button>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">ข้อมูลศิษย์เก่า</h1>
          <p className="text-sm text-[var(--muted)]">ดูและแก้ไขข้อมูลศิษย์เก่ารายบุคคล</p>
        </div>
        {tab === "profile" && !editMode && canWrite && (
          <button
            onClick={() => { setEditMode(true); setErrorMsg(""); setSuccessMsg(""); setEditReason(""); }}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
          >
            แก้ไข
          </button>
        )}
      </div>

      {/* View toggle */}
      {showTabs && (
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-white p-1">
          <button
            onClick={() => setTab("profile")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "profile"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--foreground)] hover:bg-gray-50"
            }`}
          >
            ข้อมูลศิษย์เก่า
          </button>
          <button
            onClick={() => setTab("logs")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "logs"
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--foreground)] hover:bg-gray-50"
            }`}
          >
            ประวัติการเปลี่ยนแปลง
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {tab === "logs" && !editMode ? (
        <div className="rounded-xl border border-[var(--border)] bg-gray-50 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">ประวัติการเปลี่ยนแปลง</h2>
          <AlumniActivityTimeline alumniId={alumni.id} />
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          {editMode ? (
            <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
              {/* Read-only identity */}
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลที่ไม่สามารถแก้ไขได้</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted)]">รหัสนักศึกษา</label>
                    <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.studentId}</p>
                  </div>
                  {alumni.citizenId && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">เลขบัตรประชาชน</label>
                      <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.citizenId}</p>
                    </div>
                  )}
                  {alumni.birthDate && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">วันเกิด (พ.ศ.)</label>
                      <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.birthDate}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Editable core fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="คำนำหน้า" required error={errors.prefix?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormSelect registration={register("prefix")} error={errors.prefix?.message} className={AUTH_INPUT_CLASS}>
                    <option value="">เลือกคำนำหน้า</option>
                    {PREFIX_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="ชื่อ" required error={errors.firstName?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("firstName")} error={errors.firstName?.message} type="text" className={AUTH_INPUT_CLASS} />
                </FormField>
                <FormField label="นามสกุลเดิม" required error={errors.maidenLastName?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("maidenLastName")} error={errors.maidenLastName?.message} type="text" className={AUTH_INPUT_CLASS} />
                </FormField>
                <FormField label="นามสกุลใหม่ (หลังแต่งงาน)" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("newLastName")} type="text" className={AUTH_INPUT_CLASS} />
                </FormField>
                <FormField label="รุ่นที่" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("cohort")} type="text" className={AUTH_INPUT_CLASS} />
                </FormField>
                <FormField label="ระดับปริญญา" required error={errors.degreeLevel?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormSelect registration={register("degreeLevel")} error={errors.degreeLevel?.message} className={AUTH_INPUT_CLASS}>
                    <option value="">เลือกระดับปริญญา</option>
                    {DEGREE_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="จังหวัด" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("province")} type="text" className={AUTH_INPUT_CLASS} />
                </FormField>
                <FormField label="อีเมล" error={errors.email?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("email")} error={errors.email?.message} type="email" className={AUTH_INPUT_CLASS} />
                </FormField>
                <FormField label="เบอร์โทรศัพท์" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("phone")} type="text" className={AUTH_INPUT_CLASS} />
                </FormField>
                <FormField label="สถานที่ทำงานปัจจุบัน" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("currentWorkplace")} type="text" className={AUTH_INPUT_CLASS} />
                </FormField>
                <FormField label="ประเทศ" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput registration={register("country")} type="text" className={AUTH_INPUT_CLASS} />
                </FormField>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <h3 className="mb-1 text-sm font-semibold text-[var(--muted)]">ข้อมูลเพิ่มเติม</h3>
                <p className="mb-3 text-xs text-[var(--muted)]">เปิดส่วนที่ต้องการเพื่อเพิ่มหรือแก้ไขข้อมูล หากไม่ต้องการสามารถปล่อยว่างได้</p>
              </div>

              <SectionToggle title="รางวัล" open={sections.awards} onToggle={() => toggleSection("awards")}>
                <RepeatableFieldArray control={control} register={register} errors={errors} name="awards" emptyRow={{ awardName: "", awardType: "INTERNATIONAL", year: "", description: "" }} fields={AWARD_FIELDS} />
              </SectionToggle>
              <SectionToggle title="สมาคม/ชมรม" open={sections.associations} onToggle={() => toggleSection("associations")}>
                <RepeatableFieldArray control={control} register={register} errors={errors} name="associations" emptyRow={{ associationName: "", position: "", recordedYear: "" }} fields={ASSOCIATION_FIELDS} />
              </SectionToggle>
              <SectionToggle title="กรรมการบัณฑิต" open={sections.committees} onToggle={() => toggleSection("committees")}>
                <RepeatableFieldArray control={control} register={register} errors={errors} name="graduateCommittees" emptyRow={{ termYear: "", cohort: "", position: "", remarks: "" }} fields={COMMITTEE_FIELDS} />
              </SectionToggle>
              <SectionToggle title="ศักยภาพ" open={sections.potentials} onToggle={() => toggleSection("potentials")}>
                <RepeatableFieldArray control={control} register={register} errors={errors} name="potentials" emptyRow={{ career: "", position: "", recordedYear: "" }} fields={POTENTIAL_FIELDS} />
              </SectionToggle>
              <SectionToggle title="ผู้แทนรุ่น" open={sections.modelReps} onToggle={() => toggleSection("modelReps")}>
                <RepeatableFieldArray control={control} register={register} errors={errors} name="modelRepresentatives" emptyRow={{ cohort: "", generation: "" }} fields={MODEL_REP_FIELDS} />
              </SectionToggle>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  เหตุผลในการแก้ไข <span className="text-red-500">*</span>
                </label>
                <select
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  <option value="">— กรุณาเลือก —</option>
                  {EDIT_REASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] disabled:opacity-60">
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button type="button" onClick={handleCancel} className="rounded-lg border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
                  ยกเลิก
                </button>
              </div>
            </form>
          ) : (
            /* View mode */
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลพื้นฐาน</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="รหัสนักศึกษา" value={alumni.studentId} />
                  <HotInfoField label="คำนำหน้า" value={alumni.prefix} field="prefix" alumniId={alumni.id} hot={hot} />
                  <HotInfoField label="ชื่อ" value={alumni.firstName} field="firstName" alumniId={alumni.id} hot={hot} />
                  <HotInfoField label="นามสกุลเดิม" value={alumni.maidenLastName} field="maidenLastName" alumniId={alumni.id} hot={hot} />
                  <HotInfoField label="นามสกุลใหม่" value={alumni.newLastName} field="newLastName" alumniId={alumni.id} hot={hot} />
                  <HotInfoField label="รุ่นที่" value={alumni.cohort} field="cohort" alumniId={alumni.id} hot={hot} />
                  <HotInfoField label="ระดับปริญญา" value={DEGREE_LABELS[alumni.degreeLevel] || alumni.degreeLevel} field="degreeLevel" alumniId={alumni.id} hot={hot} />
                  <HotInfoField label="จังหวัด" value={alumni.province} field="province" alumniId={alumni.id} hot={hot} />
                </div>
              </div>

              <div className="h-px bg-[var(--border)]" />

              <div>
                <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลติดต่อ</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <HotInfoField label="อีเมล" value={alumni.email} field="email" alumniId={alumni.id} hot={hot} />
                  <HotInfoField label="เบอร์โทรศัพท์" value={alumni.phone} field="phone" alumniId={alumni.id} hot={hot} />
                </div>
              </div>

              <div className="h-px bg-[var(--border)]" />

              <div>
                <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">ข้อมูลการทำงาน</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <HotInfoField label="สถานที่ทำงานปัจจุบัน" value={alumni.currentWorkplace} field="currentWorkplace" alumniId={alumni.id} hot={hot} />
                  <HotInfoField label="ประเทศ" value={alumni.country} field="country" alumniId={alumni.id} hot={hot} />
                </div>
              </div>

              {alumni.awards && alumni.awards.length > 0 && (
                <>
                  <div className="h-px bg-[var(--border)]" />
                  <RelatedSection title="รางวัล">
                    {alumni.awards.map((a) => (
                      <RelatedItem key={a.id} title={a.awardName} meta={`${AWARD_TYPE_LABELS[a.awardType] || a.awardType} • ปี ${a.year}`} detail={a.description} />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.associations && alumni.associations.length > 0 && (
                <>
                  <div className="h-px bg-[var(--border)]" />
                  <RelatedSection title="สมาคม/ชมรม">
                    {alumni.associations.map((a) => (
                      <RelatedItem key={a.id} title={a.associationName} meta={`${a.position}${a.recordedYear ? ` • ปี ${a.recordedYear}` : ""}`} />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.graduateCommittees && alumni.graduateCommittees.length > 0 && (
                <>
                  <div className="h-px bg-[var(--border)]" />
                  <RelatedSection title="กรรมการบัณฑิต">
                    {alumni.graduateCommittees.map((c) => (
                      <RelatedItem key={c.id} title={`${c.position}${c.cohort ? ` • รุ่นที่ ${c.cohort}` : ""}`} meta={c.termYear ? `ปี ${c.termYear}` : ""} detail={c.remarks} />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.potentials && alumni.potentials.length > 0 && (
                <>
                  <div className="h-px bg-[var(--border)]" />
                  <RelatedSection title="ศักยภาพ">
                    {alumni.potentials.map((p) => (
                      <RelatedItem key={p.id} title={p.career} meta={`${p.position}${p.recordedYear ? ` • ปี ${p.recordedYear}` : ""}`} />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.modelRepresentatives && alumni.modelRepresentatives.length > 0 && (
                <>
                  <div className="h-px bg-[var(--border)]" />
                  <RelatedSection title="ผู้แทนรุ่น">
                    {alumni.modelRepresentatives.map((m) => (
                      <RelatedItem key={m.id} title={`รุ่น ${m.cohort}`} meta={m.generation ? `ลำดับรุ่น ${m.generation}` : ""} />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.alumniAgency && alumni.alumniAgency.length > 0 && (
                <>
                  <div className="h-px bg-[var(--border)]" />
                  <RelatedSection title="ต้นสังกัดศิษย์เก่า">
                    {alumni.alumniAgency.map((a) => (
                      <RelatedItem key={a.id} title={a.country} meta={a.workplace || undefined} detail={[a.homeAddress, a.notes].filter(Boolean).join(" — ") || undefined} />
                    ))}
                  </RelatedSection>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--foreground)]">{value || "—"}</p>
    </div>
  );
}

function HotInfoField({
  label,
  value,
  field,
  alumniId,
  hot,
}: {
  label: string;
  value: string | null | undefined;
  field: string;
  alumniId: string;
  hot: string[];
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <div className="mt-0.5 text-sm text-[var(--foreground)]">
        <OrangeCell
          resourceType={ALUMNI_RESOURCE_TYPES}
          recordId={alumniId}
          field={field}
          value={value || "—"}
          hotFields={hot}
        />
      </div>
    </div>
  );
}

function RelatedSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RelatedItem({
  title,
  meta,
  detail,
}: {
  title: string;
  meta?: string | null;
  detail?: string | null;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-gray-50 p-3">
      <div className="text-sm font-medium text-[var(--foreground)]">{title}</div>
      {meta && <div className="mt-0.5 text-xs text-[var(--muted)]">{meta}</div>}
      {detail && <div className="mt-1 text-xs text-[var(--muted)]">{detail}</div>}
    </div>
  );
}
