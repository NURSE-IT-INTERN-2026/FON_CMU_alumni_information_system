"use client";

import { useState, useEffect, useRef } from "react";
import { useCanWrite } from "@/lib/role-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AWARD_TYPE_OPTIONS, DEGREE_LEVEL_OPTIONS, MODEL_REP_NETWORKS, BASE_PATH } from "@/lib/constants";
import {
  alumniWithRelatedFormSchema,
  type AlumniWithRelatedFormData,
} from "@/lib/validations";
import SectionToggle from "@/components/form/SectionToggle";
import RepeatableFieldArray from "@/components/form/RepeatableFieldArray";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";

// Birthday input is Buddhist-era DDMMYYYY (e.g. 01122540) — keep it digits-only.
function formatBirthDate(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

// เครือข่าย select options for the model-representative section. The leading
// blank option is required: RepeatableFieldArray's select renders only these
// options (no built-in placeholder), and emptyRow.cohort === "" must map to it
// or the UI would silently show the first network while the value stays "".
const MODEL_REP_NETWORK_OPTIONS = [
  { value: "", label: "-- เลือกเครือข่าย --" },
  ...MODEL_REP_NETWORKS.map((n) => ({ value: n, label: n })),
];

// Match the alumni-flow form (graduates profile + admin alumni edit) input /
// label styling so this create form shares the same single-card section layout.
const INPUT_CLASS = "px-4 py-2.5 text-[var(--foreground)] border-[var(--border)]";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--foreground)]";

const DEFAULT_VALUES: AlumniWithRelatedFormData = {
  studentId: "",
  prefix: "",
  firstName: "",
  lastName: "",
  degreeLevel: "" as AlumniWithRelatedFormData["degreeLevel"],
  cohort: "",
  major: "",
  graduationYear: "",
  birthDate: "",
  awards: [],
  associations: [],
  graduateCommittees: [],
  potentials: [],
  modelRepresentatives: [],
  alumniAgency: [],
};

export default function NewAlumniPage() {
  const canWrite = useCanWrite();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLoadDone = useRef(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Expandable sections (UI state only)
  const [sections, setSections] = useState({
    awards: false,
    associations: false,
    committees: false,
    potentials: false,
    modelReps: false,
    abroad: false,
  });

  const form = useForm<AlumniWithRelatedFormData>({
    resolver: zodResolver(alumniWithRelatedFormSchema) as unknown as Resolver<AlumniWithRelatedFormData>,
    defaultValues: DEFAULT_VALUES,
  });

  const {
    register,
    control,
    formState: { errors },
    handleSubmit,
    reset,
  } = form;

  // Field arrays for each section
  const associationArray = useFieldArray({ control, name: "associations" });
  const committeeArray = useFieldArray({ control, name: "graduateCommittees" });
  const potentialArray = useFieldArray({ control, name: "potentials" });
  const modelRepArray = useFieldArray({ control, name: "modelRepresentatives" });
  const abroadArray = useFieldArray({ control, name: "alumniAgency" });

  // Pre-fill from query params (redirected from entity pages)
  useEffect(() => {
    if (initialLoadDone.current) return;

    const section = searchParams.get("section");
    const nameSearch = searchParams.get("nameSearch");
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");
    const prefix = searchParams.get("prefix");

    if (!section && !nameSearch && !firstName && !lastName) return;

    initialLoadDone.current = true;

    const overrides: Partial<AlumniWithRelatedFormData> = {};
    if (nameSearch) overrides.firstName = nameSearch;
    if (firstName) overrides.firstName = firstName;
    if (lastName) overrides.lastName = lastName;
    if (prefix) overrides.prefix = prefix;

    const validSections = ["awards", "associations", "committees", "potentials", "modelReps", "abroad"] as const;
    if (section && (validSections as readonly string[]).includes(section)) {
      // One-time mount pre-fill from URL query params (guarded by
      // initialLoadDone above). Expanding the requested section is a legitimate
      // setState-in-effect: it runs once on mount and must happen after hydration
      // (reading searchParams during render would risk a hydration mismatch), so
      // the cascading-render concern the rule guards against does not apply here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSections((prev) => ({ ...prev, [section]: true }));

      switch (section) {
        case "awards":
          overrides.awards = [{
            awardName: searchParams.get("awardName") || "",
            awardType: (searchParams.get("awardType") as "INTERNATIONAL" | "NATIONAL" | "LOCAL" | null) || "INTERNATIONAL",
            year: searchParams.get("year") || "",
            description: searchParams.get("description") || "",
          }];
          break;
        case "associations":
          overrides.associations = [{
            associationName: searchParams.get("associationName") || "",
            position: searchParams.get("position") || "",
            recordedYear: searchParams.get("recordedYear") || "",
          }];
          break;
        case "committees":
          overrides.graduateCommittees = [{
            termYear: searchParams.get("termYear") || "",
            cohort: searchParams.get("cohort") || "",
            position: searchParams.get("position") || "",
            remarks: searchParams.get("remarks") || "",
          }];
          break;
        case "potentials":
          overrides.potentials = [{
            career: searchParams.get("career") || "",
            position: searchParams.get("position") || "",
            recordedYear: searchParams.get("recordedYear") || "",
          }];
          break;
        case "modelReps":
          overrides.modelRepresentatives = [{
            cohort: searchParams.get("cohort") || "",
            generation: searchParams.get("generation") || "",
          }];
          break;
        case "abroad":
          overrides.alumniAgency = [{
            country: searchParams.get("country") || "",
            workplace: searchParams.get("workplace") || "",
            homeAddress: searchParams.get("homeAddress") || "",
            notes: searchParams.get("notes") || "",
          }];
          break;
      }
    }

    reset({ ...DEFAULT_VALUES, ...overrides });
  }, [searchParams, reset]);

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => {
      const next = !prev[key];
      if (next) {
        if (key === "associations" && associationArray.fields.length === 0)
          associationArray.append({ associationName: "", position: "", recordedYear: "" });
        if (key === "committees" && committeeArray.fields.length === 0)
          committeeArray.append({ termYear: "", cohort: "", position: "", remarks: "" });
        if (key === "potentials" && potentialArray.fields.length === 0)
          potentialArray.append({ career: "", position: "", recordedYear: "" });
        if (key === "modelReps" && modelRepArray.fields.length === 0)
          modelRepArray.append({ cohort: "", generation: "" });
        if (key === "abroad" && abroadArray.fields.length === 0)
          abroadArray.append({ country: "", workplace: "", homeAddress: "", notes: "" });
      }
      return { ...prev, [key]: next };
    });

  const onSubmit = async (data: AlumniWithRelatedFormData) => {
    setSaving(true);
    setErrorMsg("");

    const payload: Record<string, unknown> = {
      studentId: data.studentId.trim(),
      prefix: data.prefix,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      birthDate: data.birthDate,
      cohort: data.cohort?.trim() || undefined,
      major: data.major?.trim() || undefined,
      graduationYear: Number(data.graduationYear),
      degreeLevel: data.degreeLevel,
    };

    if (data.awards && data.awards.length > 0) {
      payload.awards = data.awards.map((r) => ({
        awardName: r.awardName,
        awardType: r.awardType,
        year: Number(r.year),
        link: r.link,
        imageUrl: r.imageUrl,
        description: r.description,
      }));
    }
    if (data.associations && data.associations.length > 0) {
      payload.associations = data.associations.map((r) => ({
        associationName: r.associationName,
        position: r.position,
        recordedYear: Number(r.recordedYear),
      }));
    }
    if (data.graduateCommittees && data.graduateCommittees.length > 0) {
      payload.graduateCommittees = data.graduateCommittees.map((r) => ({
        termYear: Number(r.termYear),
        cohort: r.cohort,
        position: r.position,
        remarks: r.remarks,
      }));
    }
    if (data.potentials && data.potentials.length > 0) {
      payload.potentials = data.potentials.map((r) => ({
        career: r.career,
        position: r.position,
        recordedYear: Number(r.recordedYear),
      }));
    }
    if (data.modelRepresentatives && data.modelRepresentatives.length > 0) {
      payload.modelRepresentatives = data.modelRepresentatives.map((r) => ({
        cohort: r.cohort,
        generation: Number(r.generation),
      }));
    }
    if (data.alumniAgency && data.alumniAgency.length > 0) {
      payload.alumniAgency = data.alumniAgency.map((r) => ({
        country: r.country,
        workplace: r.workplace,
        homeAddress: r.homeAddress,
        notes: r.notes,
      }));
    }

    try {
      const res = await fetch(`${BASE_PATH}/api/alumni/create-with-related`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const resData = await res.json();
        setErrorMsg(resData.error || "เกิดข้อผิดพลาด");
        return;
      }

      setSuccessMsg("บันทึกข้อมูลศิษย์เก่าเรียบร้อยแล้ว");
      reset(DEFAULT_VALUES);
      setSections({ awards: false, associations: false, committees: false, potentials: false, modelReps: false, abroad: false });
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">เพิ่มข้อมูลศิษย์เก่า</h1>
            <p className="text-sm text-[var(--muted)]">กรอกข้อมูลศิษย์เก่าและข้อมูลที่เกี่ยวข้อง</p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            &larr; กลับ
          </button>
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

        {/* Single card holding the whole form — matches the alumni-flow form layout
            (graduates profile + admin alumni edit): editable core grid, a
            "ข้อมูลเพิ่มเติม" divider, the expandable sections grouped inside, and the
            action buttons at the bottom of the card. */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Core editable fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="รหัสนักศึกษา" required error={errors.studentId?.message} labelClassName={LABEL_CLASS}>
                <FormInput registration={register("studentId")} error={errors.studentId?.message} className={INPUT_CLASS} placeholder="รหัสนักศึกษา" />
              </FormField>
              <FormField label="คำนำหน้า" error={errors.prefix?.message} labelClassName={LABEL_CLASS}>
                <FormInput registration={register("prefix")} error={errors.prefix?.message} className={INPUT_CLASS} placeholder="คำนำหน้า" />
              </FormField>
              <FormField label="ชื่อ" required error={errors.firstName?.message} labelClassName={LABEL_CLASS}>
                <FormInput registration={register("firstName")} error={errors.firstName?.message} className={INPUT_CLASS} placeholder="ชื่อ" />
              </FormField>
              <FormField label="นามสกุล" required error={errors.lastName?.message} labelClassName={LABEL_CLASS}>
                <FormInput registration={register("lastName")} error={errors.lastName?.message} className={INPUT_CLASS} placeholder="นามสกุล" />
              </FormField>
              <FormField label="วันเกิด (ววปปปป พ.ศ.)" required error={errors.birthDate?.message} labelClassName={LABEL_CLASS}>
                <FormInput
                  registration={register("birthDate", {
                    onChange: (e) => {
                      e.target.value = formatBirthDate(e.target.value);
                    },
                  })}
                  error={errors.birthDate?.message}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="01122540"
                  className={INPUT_CLASS}
                />
                {!errors.birthDate && (
                  <p className="mt-1 text-xs text-[var(--muted)]">รูปแบบ: วันที่(2หลัก) เดือน(2หลัก) ปี พ.ศ.(4หลัก) เช่น 01122540</p>
                )}
              </FormField>
              <FormField label="รุ่น" labelClassName={LABEL_CLASS}>
                <FormInput registration={register("cohort")} className={INPUT_CLASS} placeholder="รุ่น" />
              </FormField>
              <FormField label="สาขา" labelClassName={LABEL_CLASS}>
                <FormInput registration={register("major")} className={INPUT_CLASS} placeholder="สาขา" />
              </FormField>
              <FormField label="ปีที่สำเร็จการศึกษา (พ.ศ.)" required error={errors.graduationYear?.message} labelClassName={LABEL_CLASS}>
                <FormInput
                  registration={register("graduationYear")}
                  error={errors.graduationYear?.message}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="2569"
                  className={INPUT_CLASS}
                />
              </FormField>
              <FormField label="ระดับการศึกษา" required error={errors.degreeLevel?.message} labelClassName={LABEL_CLASS}>
                <FormSelect registration={register("degreeLevel")} error={errors.degreeLevel?.message} className={INPUT_CLASS}>
                  <option value="">-- เลือกระดับการศึกษา --</option>
                  {DEGREE_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </div>

            {/* Divider + "ข้อมูลเพิ่มเติม" header — groups the expandable sections,
                exactly like the alumni-flow form. */}
            <div className="border-t border-[var(--border)] pt-4">
              <h3 className="mb-1 text-sm font-semibold text-[var(--muted)]">ข้อมูลเพิ่มเติม</h3>
              <p className="mb-3 text-xs text-[var(--muted)]">เปิดส่วนที่ต้องการเพื่อเพิ่มหรือแก้ไขข้อมูล หากไม่ต้องการสามารถปล่อยว่างได้</p>
            </div>

            {/* Expandable sections */}
            <SectionToggle
              title="รางวัล"
              open={sections.awards}
              onToggle={() => toggleSection("awards")}
            >
              <RepeatableFieldArray
                control={control}
                register={register}
                errors={errors}
                name="awards"
                emptyRow={{ awardName: "", awardType: "INTERNATIONAL", year: "", link: "", imageUrl: "", description: "" }}
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
                  { key: "link", label: "ลิงค์" },
                  { key: "imageUrl", label: "รูปภาพ" },
                  { key: "description", label: "รายละเอียด", type: "textarea", required: true },
                ]}
              />
            </SectionToggle>

            <SectionToggle
              title="สมาคม/ชมรม"
              open={sections.associations}
              onToggle={() => toggleSection("associations")}
            >
              <RepeatableFieldArray
                control={control}
                register={register}
                errors={errors}
                name="associations"
                emptyRow={{ associationName: "", position: "", recordedYear: "" }}
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
              <RepeatableFieldArray
                control={control}
                register={register}
                errors={errors}
                name="graduateCommittees"
                emptyRow={{ termYear: "", cohort: "", position: "", remarks: "" }}
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
              <RepeatableFieldArray
                control={control}
                register={register}
                errors={errors}
                name="potentials"
                emptyRow={{ career: "", position: "", recordedYear: "" }}
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
              <RepeatableFieldArray
                control={control}
                register={register}
                errors={errors}
                name="modelRepresentatives"
                emptyRow={{ cohort: "", generation: "" }}
                singleRow
                fields={[
                  { key: "cohort", label: "เครือข่าย", type: "select", required: true, options: MODEL_REP_NETWORK_OPTIONS },
                  { key: "generation", label: "รุ่นที่", type: "number", required: true },
                ]}
              />
            </SectionToggle>

            <SectionToggle
              title="ต้นสังกัดศิษย์เก่า"
              open={sections.abroad}
              onToggle={() => toggleSection("abroad")}
            >
              <RepeatableFieldArray
                control={control}
                register={register}
                errors={errors}
                name="alumniAgency"
                emptyRow={{ country: "", workplace: "", homeAddress: "", notes: "" }}
                singleRow
                fields={[
                  { key: "country", label: "ประเทศ", required: true },
                  { key: "workplace", label: "สถานที่ทำงาน" },
                  { key: "homeAddress", label: "ที่อยู่" },
                  { key: "notes", label: "หมายเหตุ", type: "textarea" },
                ]}
              />
            </SectionToggle>

            {/* Buttons — inside the card, matching the alumni-flow form */}
            <div className="flex gap-3 pt-2">
              {canWrite && (
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-light)] disabled:opacity-60"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              )}
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
