"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { DEGREE_LEVEL_OPTIONS, DEGREE_COLORS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Education record as returned by the education API routes. */
export interface Education {
  id: string;
  alumniId: string;
  studentId: string;
  degreeLevel: string;
  graduationYear: number | null;
  major: string | null;
  cohort: string | null;
  firstName: string | null;
  lastName: string | null;
}

const DEGREE_LABELS: Record<string, string> = Object.fromEntries(
  DEGREE_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);

interface EducationFormState {
  studentId: string;
  degreeLevel: string;
  graduationYear: string;
  major: string;
  cohort: string;
  firstName: string;
  lastName: string;
}

const EMPTY_FORM: EducationFormState = {
  studentId: "",
  degreeLevel: "",
  graduationYear: "",
  major: "",
  cohort: "",
  firstName: "",
  lastName: "",
};

interface Props {
  /** Alumni UUID this section belongs to. */
  alumniId: string;
  /** GET (list) + POST (add) base path, e.g. `/api/alumni/{id}/educations`. */
  listPath: string;
  /** Whether the viewer may add/edit (admin write roles, or the alumni themself). */
  canWrite: boolean;
  /** Called after an add/edit so the parent can refetch its alumni snapshot. */
  onChanged?: () => void;
}

/**
 * "ประวัติการศึกษา" — an alumni's degrees shown as a responsive grid of
 * colored cards (1 per row on narrow screens, 2 per row on wider ones). Each
 * card is tinted with its degree's dashboard color (`DEGREE_COLORS`) and sizes
 * to its content, so nothing overlaps or overflows; the primary degree is
 * badged. Add/edit reuse the same dialogs + CMU auto-fill. Editing the PRIMARY
 * education re-syncs the `Alumni` snapshot server-side, so `onChanged` lets the
 * host page refresh.
 */
export default function EducationSection({ alumniId, listPath, canWrite, onChanged }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<EducationFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<EducationFormState>(EMPTY_FORM);
  const [sectionMessage, setSectionMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [addMessage, setAddMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [editMessage, setEditMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.education.list(alumniId),
    queryFn: () =>
      apiFetch<{ data: Education[]; primaryEducationId: string | null }>(listPath),
  });

  const educations = data?.data ?? [];
  const primaryId = data?.primaryEducationId ?? null;
  const editingEdu = educations.find((e) => e.id === editingId) ?? null;

  const addMutation = useMutation({
    mutationFn: (form: EducationFormState) =>
      apiFetch<Education>(listPath, {
        method: "POST",
        json: {
          studentId: form.studentId.trim(),
          degreeLevel: form.degreeLevel,
          graduationYear: form.graduationYear.trim() === "" ? null : Number(form.graduationYear),
          major: form.major.trim() || null,
          cohort: form.cohort.trim() || null,
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.education.list(alumniId) });
      onChanged?.();
      setAddOpen(false);
      setAddForm(EMPTY_FORM);
      setAddMessage(null);
      setSectionMessage({ kind: "success", text: "เพิ่มหลักสูตรเรียบร้อยแล้ว" });
    },
    onError: (e) => setAddMessage({ kind: "error", text: e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล" }),
  });

  const editMutation = useMutation({
    mutationFn: (form: EducationFormState) =>
      apiFetch<Education>(`/api/educations/${editingId}`, {
        method: "PUT",
        json: {
          studentId: form.studentId.trim(),
          degreeLevel: form.degreeLevel,
          graduationYear: form.graduationYear.trim() === "" ? null : Number(form.graduationYear),
          major: form.major.trim() || null,
          cohort: form.cohort.trim() || null,
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.education.list(alumniId) });
      onChanged?.();
      setEditOpen(false);
      setEditMessage(null);
      setSectionMessage({ kind: "success", text: "บันทึกการแก้ไขเรียบร้อยแล้ว" });
    },
    onError: (e) => setEditMessage({ kind: "error", text: e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล" }),
  });

  async function lookupCmu(studentId: string, target: "add" | "edit") {
    const sid = studentId.trim();
    if (!sid) return;
    const setMsg = target === "add" ? setAddMessage : setEditMessage;
    setLookingUp(true);
    try {
      const res = await apiFetch<{
        degreeLevel: string;
        graduationYear: number | null;
        major: string | null;
        cohort: string | null;
        firstName: string | null;
        lastName: string | null;
        samePersonWarning?: string | null;
        alreadyClaimed?: string | null;
      }>(`/api/cmu-alumni/lookup?studentId=${encodeURIComponent(sid)}&alumniId=${encodeURIComponent(alumniId)}`);
      const patch: EducationFormState = {
        studentId: sid,
        degreeLevel: res.degreeLevel || "",
        graduationYear: res.graduationYear != null ? String(res.graduationYear) : "",
        major: res.major ?? "",
        cohort: res.cohort ?? "",
        firstName: res.firstName ?? "",
        lastName: res.lastName ?? "",
      };
      if (target === "add") setAddForm(patch);
      else setEditForm((f) => ({ ...patch, studentId: f.studentId }));
      // Prefer the "already claimed by another alumni" warning (contact admin)
      // over the birthday (same-person) warning when both apply.
      const claimOrIdentityMsg = res.alreadyClaimed ?? res.samePersonWarning;
      if (claimOrIdentityMsg) {
        setMsg({ kind: "error", text: claimOrIdentityMsg });
      } else {
        setMsg({ kind: "success", text: "ดึงข้อมูลจากระบบทะเบียนสำเร็จ" });
      }
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof ApiError ? e.message : "ไม่พบข้อมูลในระบบทะเบียน" });
    } finally {
      setLookingUp(false);
    }
  }

  function openEdit(edu: Education) {
    setEditingId(edu.id);
    setEditForm({
      studentId: edu.studentId,
      degreeLevel: edu.degreeLevel,
      graduationYear: edu.graduationYear != null ? String(edu.graduationYear) : "",
      major: edu.major ?? "",
      cohort: edu.cohort ?? "",
      firstName: edu.firstName ?? "",
      lastName: edu.lastName ?? "",
    });
    setEditMessage(null);
    setSectionMessage(null);
    setEditOpen(true);
  }

  function openAdd() {
    setAddForm(EMPTY_FORM);
    setAddMessage(null);
    setSectionMessage(null);
    setAddOpen(true);
  }

  return (
    <div className="rounded-lg border border-purple-100 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--primary-dark)]">ประวัติการศึกษา</h3>
          <p className="text-[11px] text-purple-700/70">
            หลักสูตรหลักคือระดับปริญญาสูงสุด (ระบบเลือกโดยอัตโนมัติ เปลี่ยนเองไม่ได้)
          </p>
        </div>
        {canWrite && (
          <Button type="button" size="sm" variant="outline" onClick={openAdd}>
            + เพิ่มหลักสูตร
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-purple-700/70">กำลังโหลด…</p>
      ) : educations.length === 0 ? (
        <p className="py-10 text-center text-sm text-purple-700/70">ยังไม่มีข้อมูลการศึกษา</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {educations.map((edu) => {
            const color = DEGREE_COLORS[edu.degreeLevel] ?? "#6b7280";
            const isPrimary = edu.id === primaryId;
            return (
              <div
                key={edu.id}
                className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
                style={{ borderTop: `5px solid ${color}`, backgroundColor: `${color}0D` }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-base font-bold" style={{ color }}>
                    {DEGREE_LABELS[edu.degreeLevel] ?? edu.degreeLevel}
                  </span>
                  {isPrimary && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: `${color}1A`, color }}
                    >
                      หลักสูตรหลัก
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <Field label="รหัสนักศึกษา" value={edu.studentId} />
                  <Field label="รุ่นที่" value={edu.cohort || "—"} />
                  <Field label="สาขาวิชา" value={edu.major || "—"} />
                  <Field label="ปีที่จบ" value={edu.graduationYear != null ? String(edu.graduationYear) : "—"} />
                  <Field label="ชื่อ(ขณะศึกษา)" value={edu.firstName || "—"} />
                  <Field label="นามสกุล(ขณะศึกษา)" value={edu.lastName || "—"} />
                </dl>
                {canWrite && (
                  <div className="mt-3 text-right">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEdit(edu)}>
                      แก้ไข
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sectionMessage && (
        <p className={`mt-3 text-center text-sm ${sectionMessage.kind === "error" ? "text-red-600" : "text-green-600"}`}>
          {sectionMessage.text}
        </p>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มหลักสูตรการศึกษา</DialogTitle>
            <DialogDescription>
              กรอกรหัสนักศึกษาแล้วกด &quot;ดึงจากทะเบียน&quot; เพื่อเติมข้อมูลอัตโนมัติ หรือกรอกเองได้
            </DialogDescription>
          </DialogHeader>
          <EducationForm
            form={addForm}
            onChange={setAddForm}
            lookingUp={lookingUp}
            onLookup={() => lookupCmu(addForm.studentId, "add")}
          />
          {addMessage && (
            <p className={`text-sm ${addMessage.kind === "error" ? "text-red-600" : "text-green-600"}`}>
              {addMessage.text}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addMutation.isPending}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => addMutation.mutate(addForm)}
              disabled={addMutation.isPending || !addForm.studentId.trim() || !addForm.degreeLevel}
            >
              {addMutation.isPending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขหลักสูตรการศึกษา</DialogTitle>
            <DialogDescription>
              {editingEdu?.id === primaryId
                ? "หลักสูตรนี้เป็นหลักสูตรหลัก (ระดับปริญญาสูงสุด เลือกโดยอัตโนมัติ) — การแก้ไขจะอัปเดตข้อมูลหลักของศิษย์เก่าท่านนี้ด้วย"
                : "แก้ไขรายละเอียดหลักสูตรนี้"}
            </DialogDescription>
          </DialogHeader>
          <EducationForm
            form={editForm}
            onChange={setEditForm}
            lookingUp={lookingUp}
            onLookup={() => lookupCmu(editForm.studentId, "edit")}
          />
          {editMessage && (
            <p className={`text-sm ${editMessage.kind === "error" ? "text-red-600" : "text-green-600"}`}>
              {editMessage.text}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editMutation.isPending}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => editMutation.mutate(editForm)}
              disabled={editMutation.isPending || !editForm.studentId.trim() || !editForm.degreeLevel}
            >
              {editMutation.isPending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-purple-700/70">{label}</dt>
      <dd className="break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function EducationForm({
  form,
  onChange,
  lookingUp,
  onLookup,
}: {
  form: EducationFormState;
  onChange: (f: EducationFormState) => void;
  lookingUp: boolean;
  onLookup: () => void;
}) {
  const set = (key: keyof EducationFormState, value: string) =>
    onChange({ ...form, [key]: value });
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="edu-studentId">รหัสนักศึกษา</Label>
        <div className="flex gap-2">
          <Input
            id="edu-studentId"
            value={form.studentId}
            onChange={(e) => set("studentId", e.target.value)}
            inputMode="numeric"
          />
          <Button type="button" variant="secondary" size="sm" onClick={onLookup} disabled={lookingUp || !form.studentId.trim()}>
            {lookingUp ? "…" : "ดึงจากทะเบียน"}
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="edu-degree">ระดับปริญญา</Label>
        <Select value={form.degreeLevel} onValueChange={(v) => set("degreeLevel", v)}>
          <SelectTrigger id="edu-degree" className="w-full">
            <SelectValue placeholder="เลือกระดับปริญญา" />
          </SelectTrigger>
          <SelectContent>
            {DEGREE_LEVEL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="edu-year">ปีที่จบ (พ.ศ.)</Label>
          <Input
            id="edu-year"
            value={form.graduationYear}
            onChange={(e) => set("graduationYear", e.target.value)}
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edu-cohort">รุ่นที่</Label>
          <Input
            id="edu-cohort"
            value={form.cohort}
            onChange={(e) => set("cohort", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="edu-major">สาขาวิชา</Label>
        <Input
          id="edu-major"
          value={form.major}
          onChange={(e) => set("major", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="edu-firstName">ชื่อ(ขณะศึกษา)</Label>
          <Input
            id="edu-firstName"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edu-lastName">นามสกุล(ขณะศึกษา)</Label>
          <Input
            id="edu-lastName"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
