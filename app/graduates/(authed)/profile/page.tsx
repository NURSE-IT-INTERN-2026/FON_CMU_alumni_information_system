"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AWARD_TYPE_OPTIONS,
  AWARD_TYPE_LABELS,
  DEGREE_LEVEL_OPTIONS,
  PREFIX_OPTIONS,
} from "@/lib/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import {
  alumniProfileWithRelatedFormSchema,
  type AlumniProfileWithRelatedFormData,
} from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";
import SectionToggle from "@/components/form/SectionToggle";
import RepeatableFieldArray, { type FieldDef } from "@/components/form/RepeatableFieldArray";
import { ConfirmDialog } from "@/components/confirm-dialog";
import EducationSection from "@/components/EducationSection";
import { SectionHeading } from "@/components/SectionHeading";
import { parsePhones, joinPhones } from "@/lib/parse-phone";
import { formatBirthDateThaiSlash } from "@/lib/alumni-verify";

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
interface AbroadData {
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
  lastName: string;
  cohort: string | null;
  degreeLevel: string;
  email: string | null;
  contactEmail: string | null;
  phones: string[];
  homeAddress: string | null;
  hasLoggedIn: boolean;
  adminEditedAt: string | null;
  lastLoginAt: string | null;
  awards?: AwardData[];
  associations?: AssociationData[];
  graduateCommittees?: CommitteeData[];
  potentials?: PotentialData[];
  modelRepresentatives?: ModelRepData[];
  alumniAgency?: AbroadData[];
}

const AUTH_INPUT_CLASS = "px-4 py-2.5 text-[var(--foreground)] border-[var(--border)]";
const AUTH_LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--foreground)]";

const defaultFormValues: AlumniProfileWithRelatedFormData = {
  prefix: "",
  firstName: "",
  lastName: "",
  cohort: "",
  degreeLevel: "",
  email: "",
  contactEmail: "",
  phones: "",
  homeAddress: "",
  awards: [],
  associations: [],
  graduateCommittees: [],
  potentials: [],
  modelRepresentatives: [],
  alumniAgency: [],
};

// --- Repeatable-field definitions for each expandable section ---

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
const ABROAD_FIELDS: FieldDef[] = [
  { key: "country", label: "ประเทศ", required: true },
  { key: "workplace", label: "สถานที่ทำงาน" },
  { key: "homeAddress", label: "ที่อยู่" },
  { key: "notes", label: "หมายเหตุ", type: "textarea" },
];

// Map a fetched alumni record (with related arrays) to form values.
function buildFormValues(data: AlumniData): AlumniProfileWithRelatedFormData {
  return {
    prefix: data.prefix || "",
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    cohort: data.cohort || "",
    degreeLevel: data.degreeLevel || "",
    email: data.email || "",
    contactEmail: data.contactEmail || "",
    phones: joinPhones(data.phones),
    homeAddress: data.homeAddress || "",
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
    alumniAgency: (data.alumniAgency || []).map((a) => ({
      country: a.country,
      workplace: a.workplace || "",
      homeAddress: a.homeAddress || "",
      notes: a.notes || "",
    })),
  };
}

function sectionsFromData(data: AlumniData) {
  return {
    awards: (data.awards?.length ?? 0) > 0,
    associations: (data.associations?.length ?? 0) > 0,
    committees: (data.graduateCommittees?.length ?? 0) > 0,
    potentials: (data.potentials?.length ?? 0) > 0,
    modelReps: (data.modelRepresentatives?.length ?? 0) > 0,
    abroad: (data.alumniAgency?.length ?? 0) > 0,
  };
}

export default function AlumniProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Expandable sections (UI state only) — auto-opened when data exists.
  const [sections, setSections] = useState({
    awards: false,
    associations: false,
    committees: false,
    potentials: false,
    modelReps: false,
    abroad: false,
  });

  // Modals
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [showAdminEditModal, setShowAdminEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset: formReset,
    formState: { errors },
  } = useForm<AlumniProfileWithRelatedFormData>({
    resolver: zodResolver(alumniProfileWithRelatedFormSchema) as unknown as Resolver<AlumniProfileWithRelatedFormData>,
    defaultValues: defaultFormValues,
  });

  const qc = useQueryClient();
  const { data: alumni, isPending: loading, error } = useQuery({
    queryKey: queryKeys.alumniProfile.me(),
    queryFn: () => apiFetch<AlumniData>("/api/alumni-profile"),
  });

  // 401 (expired/missing session) -> back to login.
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.push("/login");
  }, [error, router]);

  // Populate form + modal state whenever the fetched profile changes (initial
  // load + post-save). Skipped while editing so in-progress edits aren't
  // clobbered by a background refetch.
  /* eslint-disable react-hooks/set-state-in-effect -- populating react-hook-form + section state from the fetched profile is inherently a data->state sync */
  useEffect(() => {
    if (!alumni || editMode) return;
    formReset(buildFormValues(alumni));
    setSections(sectionsFromData(alumni));

    // Check first-login modal
    const firstParam = searchParams.get("first");
    const dismissedFirst = localStorage.getItem(`alumni-first-login-dismissed-${alumni.id}`);
    if ((firstParam === "1" || !dismissedFirst) && alumni.hasLoggedIn) {
      if (!dismissedFirst) setShowFirstLoginModal(true);
    }

    // Check admin-edit notification
    if (alumni.adminEditedAt) {
      const lastSeen = localStorage.getItem(`alumni-admin-edit-seen-${alumni.id}`);
      if (!lastSeen || new Date(alumni.adminEditedAt) > new Date(lastSeen)) {
        setShowAdminEditModal(true);
      }
    }
  }, [alumni, editMode, formReset, searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function dismissFirstLoginModal() {
    if (alumni) {
      localStorage.setItem(`alumni-first-login-dismissed-${alumni.id}`, "true");
    }
    setShowFirstLoginModal(false);
  }

  function dismissAdminEditModal() {
    if (alumni?.adminEditedAt) {
      localStorage.setItem(`alumni-admin-edit-seen-${alumni.id}`, alumni.adminEditedAt);
    }
    setShowAdminEditModal(false);
  }

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  async function handleSave(data: AlumniProfileWithRelatedFormData) {
    setErrorMsg("");
    setSuccessMsg("");
    setSaving(true);

    const payload: Record<string, unknown> = {
      prefix: data.prefix,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      cohort: data.cohort?.trim() || "",
      degreeLevel: data.degreeLevel,
      email: data.email?.trim() || "",
      contactEmail: data.contactEmail?.trim() || "",
      phones: parsePhones(data.phones),
      homeAddress: data.homeAddress?.trim() || "",
      // Send every section so the server can apply replace-all semantics
      // (empty array = clear existing entries for that section).
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
      alumniAgency: (data.alumniAgency || []).map((a) => ({
        country: a.country,
        workplace: a.workplace,
        homeAddress: a.homeAddress,
        notes: a.notes,
      })),
    };

    try {
      const updated = await apiFetch<AlumniData>("/api/alumni-profile", { method: "PUT", json: payload });
      qc.setQueryData(queryKeys.alumniProfile.me(), updated);
      setEditMode(false);
      setSuccessMsg("บันทึกข้อมูลเรียบร้อยแล้ว");
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
    // Reset form (incl. related arrays) back to the last-fetched alumni data.
    if (alumni) {
      formReset(buildFormValues(alumni));
      setSections(sectionsFromData(alumni));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setErrorMsg("");
    try {
      await apiFetch("/api/alumni-profile", { method: "DELETE" });
      // Record tombstoned + sessions cleared server-side — leave the app.
      router.push("/login");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push("/login");
        return;
      }
      setErrorMsg(e instanceof Error ? e.message : "ไม่สามารถลบข้อมูลได้");
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!alumni) {
    return (
      <div className="py-20 text-center">
        <p className="text-[var(--danger)]">{errorMsg || "ไม่พบข้อมูลศิษย์เก่า"}</p>
      </div>
    );
  }

  return (
    <>
      {/* First-login modal */}
      {showFirstLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <svg className="h-6 w-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">พบข้อมูลของท่านในระบบแล้ว</h3>
            <p className="mb-6 text-sm text-purple-700">
              พบข้อมูลของท่านในระบบแล้ว กรุณาตรวจสอบและแก้ไขข้อมูลตามต้องการ
            </p>
            <button
              onClick={dismissFirstLoginModal}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* Admin-edit notification modal */}
      {showAdminEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-[var(--foreground)]">ผู้ดูแลระบบได้แก้ไขข้อมูลของท่าน</h3>
            <p className="mb-6 text-sm text-purple-700">
              ผู้ดูแลระบบได้แก้ไขข้อมูลของท่าน กรุณาตรวจสอบความถูกต้อง หากไม่ถูกต้องกรุณาติดต่อผู้ดูแลระบบ
            </p>
            <button
              onClick={dismissAdminEditModal}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">ข้อมูลส่วนตัว</h1>
            <p className="text-sm text-purple-700">ดูและแก้ไขข้อมูลส่วนตัวของท่าน</p>
          </div>
          {!editMode && (
            <button
              onClick={() => { setEditMode(true); setErrorMsg(""); setSuccessMsg(""); }}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)]"
            >
              แก้ไข
            </button>
          )}
        </div>

        {/* Messages */}
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

        {/* Profile card */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          {editMode ? (
            <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
              {/* Read-only fields */}
              <div className="rounded-lg bg-purple-50 p-4">
                <SectionHeading title="ข้อมูลที่ไม่สามารถแก้ไขได้" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">รหัสนักศึกษา</label>
                    <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.studentId}</p>
                  </div>
                  {alumni.citizenId && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">เลขบัตรประชาชน</label>
                      <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.citizenId}</p>
                    </div>
                  )}
                  {alumni.birthDate && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">วันเกิด (พ.ศ.)</label>
                      <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm text-[var(--foreground)]">{alumni.birthDate}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="คำนำหน้า" error={errors.prefix?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormSelect
                    registration={register("prefix")}
                    error={errors.prefix?.message}
                    className={AUTH_INPUT_CLASS}
                  >
                    <option value="">เลือกคำนำหน้า</option>
                    {PREFIX_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </FormSelect>
                </FormField>

                <FormField label="ชื่อ" required error={errors.firstName?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("firstName")}
                    error={errors.firstName?.message}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="นามสกุล" required error={errors.lastName?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("lastName")}
                    error={errors.lastName?.message}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="รุ่นที่" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("cohort")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="ระดับปริญญา" required error={errors.degreeLevel?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormSelect
                    registration={register("degreeLevel")}
                    error={errors.degreeLevel?.message}
                    className={AUTH_INPUT_CLASS}
                  >
                    <option value="">เลือกระดับปริญญา</option>
                    {DEGREE_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </FormSelect>
                </FormField>

                <FormField label="อีเมล (เข้าสู่ระบบ)" error={errors.email?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("email")}
                    error={errors.email?.message}
                    type="email"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="อีเมลติดต่อ" error={errors.contactEmail?.message} labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("contactEmail")}
                    error={errors.contactEmail?.message}
                    type="email"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="เบอร์โทรศัพท์ (คั่นหลายเบอร์ด้วยจุลภาค)" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("phones")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>

                <FormField label="ที่อยู่ปัจจุบัน" labelClassName={AUTH_LABEL_CLASS}>
                  <FormInput
                    registration={register("homeAddress")}
                    type="text"
                    className={AUTH_INPUT_CLASS}
                  />
                </FormField>
              </div>

              {/* Expandable additional-data sections */}
              <div className="border-t border-[var(--border)] pt-4">
                <h3 className="mb-1 text-sm font-semibold text-[var(--primary-dark)]">ข้อมูลเพิ่มเติม</h3>
                <p className="mb-3 text-xs text-purple-700/70">เปิดส่วนที่ต้องการเพื่อเพิ่มหรือแก้ไขข้อมูล หากไม่ต้องการสามารถปล่อยว่างได้</p>
              </div>

              <SectionToggle title="รางวัล" open={sections.awards} onToggle={() => toggleSection("awards")}>
                <RepeatableFieldArray
                  control={control}
                  register={register}
                  errors={errors}
                  name="awards"
                  emptyRow={{ awardName: "", awardType: "INTERNATIONAL", year: "", description: "" }}
                  fields={AWARD_FIELDS}
                />
              </SectionToggle>

              <SectionToggle title="สมาคม/ชมรม" open={sections.associations} onToggle={() => toggleSection("associations")}>
                <RepeatableFieldArray
                  control={control}
                  register={register}
                  errors={errors}
                  name="associations"
                  emptyRow={{ associationName: "", position: "", recordedYear: "" }}
                  fields={ASSOCIATION_FIELDS}
                />
              </SectionToggle>

              <SectionToggle title="กรรมการบัณฑิต" open={sections.committees} onToggle={() => toggleSection("committees")}>
                <RepeatableFieldArray
                  control={control}
                  register={register}
                  errors={errors}
                  name="graduateCommittees"
                  emptyRow={{ termYear: "", cohort: "", position: "", remarks: "" }}
                  fields={COMMITTEE_FIELDS}
                />
              </SectionToggle>

              <SectionToggle title="ศักยภาพ" open={sections.potentials} onToggle={() => toggleSection("potentials")}>
                <RepeatableFieldArray
                  control={control}
                  register={register}
                  errors={errors}
                  name="potentials"
                  emptyRow={{ career: "", position: "", recordedYear: "" }}
                  fields={POTENTIAL_FIELDS}
                />
              </SectionToggle>

              <SectionToggle title="ผู้แทนรุ่น" open={sections.modelReps} onToggle={() => toggleSection("modelReps")}>
                <RepeatableFieldArray
                  control={control}
                  register={register}
                  errors={errors}
                  name="modelRepresentatives"
                  emptyRow={{ cohort: "", generation: "" }}
                  fields={MODEL_REP_FIELDS}
                />
              </SectionToggle>

              <SectionToggle title="ข้อมูลการทำงานศิษย์เก่า" open={sections.abroad} onToggle={() => toggleSection("abroad")}>
                <RepeatableFieldArray
                  control={control}
                  register={register}
                  errors={errors}
                  name="alumniAgency"
                  emptyRow={{ country: "", workplace: "", homeAddress: "", notes: "" }}
                  fields={ABROAD_FIELDS}
                />
              </SectionToggle>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] disabled:opacity-60"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-purple-50"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          ) : (
            /* View mode */
            <div className="space-y-6">
              {/* ข้อมูลส่วนตัว */}
              <div>
                <SectionHeading title="ข้อมูลส่วนตัว" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="คำนำหน้า" value={alumni.prefix} />
                  <InfoField label="ชื่อ" value={alumni.firstName} />
                  <InfoField label="นามสกุล" value={alumni.lastName} />
                  <InfoField label="วันเกิด (วว/ดด/ปปปป)" value={formatBirthDateThaiSlash(alumni.birthDate)} />
                </div>
              </div>

              <EducationSection
                alumniId={alumni.id}
                listPath="/api/alumni-profile/educations"
                canWrite
                onChanged={() => qc.invalidateQueries({ queryKey: queryKeys.alumniProfile.me() })}
              />

              <div className="h-px bg-purple-100" />

              {/* Contact section */}
              <div>
                <SectionHeading title="ข้อมูลติดต่อ" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="อีเมล (เข้าสู่ระบบ)" value={alumni.email} />
                  <InfoField label="อีเมลติดต่อ" value={alumni.contactEmail} />
                  <InfoField label="เบอร์โทรศัพท์" value={joinPhones(alumni.phones)} />
                  <InfoField label="ที่อยู่ปัจจุบัน" value={alumni.homeAddress} />
                </div>
              </div>

              {/* Additional data — each section renders only when it has entries */}
              {alumni.awards && alumni.awards.length > 0 && (
                <>
                  <div className="h-px bg-purple-100" />
                  <RelatedSection title="รางวัล">
                    {alumni.awards.map((a) => (
                      <RelatedItem
                        key={a.id}
                        title={a.awardName}
                        meta={`${AWARD_TYPE_LABELS[a.awardType] || a.awardType} • ปี ${a.year}`}
                        detail={a.description}
                      />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.associations && alumni.associations.length > 0 && (
                <>
                  <div className="h-px bg-purple-100" />
                  <RelatedSection title="สมาคม/ชมรม">
                    {alumni.associations.map((a) => (
                      <RelatedItem
                        key={a.id}
                        title={a.associationName}
                        meta={`${a.position}${a.recordedYear ? ` • ปี ${a.recordedYear}` : ""}`}
                      />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.graduateCommittees && alumni.graduateCommittees.length > 0 && (
                <>
                  <div className="h-px bg-purple-100" />
                  <RelatedSection title="กรรมการบัณฑิต">
                    {alumni.graduateCommittees.map((c) => (
                      <RelatedItem
                        key={c.id}
                        title={`${c.position}${c.cohort ? ` • รุ่นที่ ${c.cohort}` : ""}`}
                        meta={c.termYear ? `ปี ${c.termYear}` : ""}
                        detail={c.remarks}
                      />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.potentials && alumni.potentials.length > 0 && (
                <>
                  <div className="h-px bg-purple-100" />
                  <RelatedSection title="ศักยภาพ">
                    {alumni.potentials.map((p) => (
                      <RelatedItem
                        key={p.id}
                        title={p.career}
                        meta={`${p.position}${p.recordedYear ? ` • ปี ${p.recordedYear}` : ""}`}
                      />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.modelRepresentatives && alumni.modelRepresentatives.length > 0 && (
                <>
                  <div className="h-px bg-purple-100" />
                  <RelatedSection title="ผู้แทนรุ่น">
                    {alumni.modelRepresentatives.map((m) => (
                      <RelatedItem
                        key={m.id}
                        title={`รุ่น ${m.cohort}`}
                        meta={m.generation ? `ลำดับรุ่น ${m.generation}` : ""}
                      />
                    ))}
                  </RelatedSection>
                </>
              )}

              {alumni.alumniAgency && alumni.alumniAgency.length > 0 && (
                <>
                  <div className="h-px bg-purple-100" />
                  <RelatedSection title="ข้อมูลการทำงานศิษย์เก่า">
                    {alumni.alumniAgency.map((a) => (
                      <RelatedItem
                        key={a.id}
                        title={a.country}
                        meta={a.workplace || undefined}
                        detail={[a.homeAddress, a.notes].filter(Boolean).join(" — ") || undefined}
                      />
                    ))}
                  </RelatedSection>
                </>
              )}
            </div>
          )}
        </div>

        {/* Danger zone — shown only while editing */}
        {editMode && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h3 className="text-sm font-semibold text-red-700">ลบข้อมูล</h3>
            <p className="mt-1 text-sm text-red-600">
              การลบข้อมูลจะเป็นการลบข้อมูลศิษย์เก่าของท่านออกจากระบบ และท่านจะไม่สามารถเข้าสู่ระบบได้อีกจนกว่าผู้ดูแลระบบจะกู้คืนข้อมูลให้
            </p>
            <button
              type="button"
              onClick={() => { setShowDeleteDialog(true); setErrorMsg(""); }}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              ลบข้อมูล
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="ยืนยันการลบข้อมูล"
        description="ท่านแน่ใจหรือไม่ว่าต้องการลบข้อมูลศิษย์เก่าของท่าน? การกระทำนี้ไม่สามารถย้อนกลับได้โดยท่านเอง ผู้ดูแลระบบสามารถกู้คืนข้อมูลให้ท่านได้"
        confirmLabel="ลบข้อมูล"
        onConfirm={handleDelete}
        loading={deleting}
        destructive
      />
    </>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--primary-dark)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--foreground)]">{value || "—"}</p>
    </div>
  );
}

function RelatedSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <SectionHeading title={title} />
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
    <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
      <div className="text-sm font-medium text-[var(--foreground)]">{title}</div>
      {meta && <div className="mt-0.5 text-xs text-purple-700/70">{meta}</div>}
      {detail && <div className="mt-1 text-xs text-purple-700/70">{detail}</div>}
    </div>
  );
}
