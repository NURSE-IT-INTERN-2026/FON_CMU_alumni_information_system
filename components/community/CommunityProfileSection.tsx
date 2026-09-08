"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/SectionHeading";
import { BASE_PATH } from "@/lib/constants";
import { validateImageFile } from "@/lib/upload-limits";
import { assetUrl } from "@/lib/asset-url";
import { THAI_PROVINCES } from "@/lib/thai-provinces";

/**
 * "โปรไฟล์ชุมชนศิษย์เก่า" — the opted-in alumni's self-published profile card
 * on the graduates profile page. Fully self-contained (own edit state + save
 * via PUT /api/community-profile) so it stays independent of the page's main
 * profile form. Only opted-in alumni get the form; others see a compact
 * join-community card.
 */

interface CommunityProfileRow {
  id: string;
  photoUrl: string | null;
  currentWorkplace: string | null;
  currentPosition: string | null;
  province: string | null;
  country: string | null;
  bio: string | null;
  contactEmail: string | null;
  facebookUrl: string | null;
  lineId: string | null;
  linkedinUrl: string | null;
  otherLink: string | null;
}

/** Editable form state — photoUrl keeps null (no image), text fields are "" when empty. */
type FormValues = {
  photoUrl: string | null;
} & Record<Exclude<keyof Omit<CommunityProfileRow, "id" | "photoUrl">, symbol>, string>;

const EMPTY_FORM: FormValues = {
  photoUrl: null,
  currentWorkplace: "",
  currentPosition: "",
  province: "",
  country: "",
  bio: "",
  contactEmail: "",
  facebookUrl: "",
  lineId: "",
  linkedinUrl: "",
  otherLink: "",
};

function toForm(p: CommunityProfileRow | null): FormValues {
  if (!p) return { ...EMPTY_FORM };
  return {
    photoUrl: p.photoUrl,
    currentWorkplace: p.currentWorkplace ?? "",
    currentPosition: p.currentPosition ?? "",
    province: p.province ?? "",
    country: p.country ?? "",
    bio: p.bio ?? "",
    contactEmail: p.contactEmail ?? "",
    facebookUrl: p.facebookUrl ?? "",
    lineId: p.lineId ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    otherLink: p.otherLink ?? "",
  };
}

const TEXT_FIELDS: { key: keyof FormValues; label: string; placeholder?: string; type?: string }[] = [
  { key: "currentWorkplace", label: "สถานที่ทำงานปัจจุบัน", placeholder: "เช่น โรงพยาบาลมหาวิทยาลัยเชียงใหม่" },
  { key: "currentPosition", label: "ตำแหน่ง", placeholder: "เช่น หัวหน้าวิชาการพยาบาล" },
  { key: "contactEmail", label: "อีเมลที่เผยแพร่ (ไม่บังคับ)", placeholder: "อีเมลสำหรับให้ศิษย์เก่าติดต่อท่าน", type: "email" },
  { key: "facebookUrl", label: "Facebook (ลิงก์)", type: "url" },
  { key: "lineId", label: "LINE ID" },
  { key: "linkedinUrl", label: "LinkedIn (ลิงก์)", type: "url" },
  { key: "otherLink", label: "เว็บไซต์อื่น ๆ (ลิงก์)", type: "url" },
];

const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30";

export default function CommunityProfileSection() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const { data: membership } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ optedIn: boolean }>("/api/alumni-profile/community-membership"),
  });
  const optedIn = membership?.optedIn ?? false;

  const { data: profileData } = useQuery({
    queryKey: queryKeys.community.profile(),
    queryFn: () => apiFetch<{ profile: CommunityProfileRow | null }>("/api/community-profile"),
    enabled: optedIn,
  });
  const profile = profileData?.profile ?? null;

  const joinMutation = useMutation({
    mutationFn: (action: "opt-in") =>
      apiFetch("/api/alumni-profile/community-membership", { method: "POST", json: { action } }),
    onSuccess: () => {
      setJoinError(null);
      qc.invalidateQueries({ queryKey: queryKeys.forum.all });
    },
    onError: (e) => setJoinError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด"),
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      apiFetch("/api/community-profile", {
        method: "PUT",
        // Trim; drop empty strings to null so clearing works server-side too.
        json: Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : v]),
        ),
      }),
    onSuccess: () => {
      setEditing(false);
      setFormError(null);
      qc.invalidateQueries({ queryKey: queryKeys.community.all });
    },
    onError: (e) => setFormError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการบันทึก"),
  });

  async function uploadPhoto(file: File) {
    const invalid = validateImageFile(file);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/alumni-upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
      }
      const { url } = await res.json();
      setForm((prev) => ({ ...prev, photoUrl: url }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function startEditing() {
    setForm(toForm(profile));
    setFormError(null);
    setEditing(true);
  }

  // --- Not opted in: compact join card ---
  if (membership && !optedIn) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <SectionHeading title="โปรไฟล์ชุมชนศิษย์เก่า" />
        <p className="mb-4 mt-2 text-sm text-[var(--muted)]">
          เข้าร่วมชุมชนศิษย์เก่าเพื่อสร้างโปรไฟล์ชุมชนของท่าน และให้ศิษย์เก่าท่านอื่นค้นหาพบท่านในไดเรกทอรีศิษย์เก่า
          ท่านเลือกเผยแพร่เฉพาะข้อมูลที่ท่านต้องการ
        </p>
        {joinError && <p className="mb-3 text-sm text-red-600">{joinError}</p>}
        <div className="flex gap-2">
          <Button onClick={() => joinMutation.mutate("opt-in")} disabled={joinMutation.isPending}>
            {joinMutation.isPending ? "กำลังเข้าร่วม..." : "เข้าร่วมชุมชน"}
          </Button>
          <Link href="/graduates/forum">
            <Button variant="outline">ดูรายละเอียด</Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayPhoto = editing ? form.photoUrl : profile?.photoUrl ?? null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <SectionHeading title="โปรไฟล์ชุมชนศิษย์เก่า" />
        {!editing && (
          <Button variant="outline" onClick={startEditing} className="text-sm">
            {profile ? "แก้ไข" : "กรอกโปรไฟล์"}
          </Button>
        )}
      </div>

      {!editing ? (
        profile ? (
          <div className="space-y-4">
            {displayPhoto && (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(displayPhoto)}
                  alt="รูปโปรไฟล์ชุมชน"
                  className="h-16 w-16 rounded-full object-cover"
                />
                <Link href="/graduates/directory" className="text-sm text-[var(--primary)] hover:underline">
                  ดูตัวอย่างในไดเรกทอรีศิษย์เก่า
                </Link>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {profile.currentWorkplace && <p><span className="text-[var(--muted)]">สถานที่ทำงาน:</span> {profile.currentWorkplace}</p>}
              {profile.currentPosition && <p><span className="text-[var(--muted)]">ตำแหน่ง:</span> {profile.currentPosition}</p>}
              {(profile.province || profile.country) && (
                <p><span className="text-[var(--muted)]">พื้นที่:</span> {[profile.province, profile.country].filter(Boolean).join(", ")}</p>
              )}
              {profile.contactEmail && <p className="break-all"><span className="text-[var(--muted)]">อีเมลที่เผยแพร่:</span> {profile.contactEmail}</p>}
              {profile.lineId && <p><span className="text-[var(--muted)]">LINE ID:</span> {profile.lineId}</p>}
            </div>
            {profile.bio && (
              <p className="whitespace-pre-line rounded-lg bg-[var(--background)] p-3 text-sm">{profile.bio}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            ท่านยังไม่ได้กรอกโปรไฟล์ชุมชน — กรอกเพื่อให้ศิษย์เก่าท่านอื่นค้นหาและรู้จักท่านมากขึ้น
          </p>
        )
      ) : (
        <div className="space-y-4">
          {/* Photo */}
          <div className="flex items-center gap-4">
            {form.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(form.photoUrl)} alt="preview" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-xs text-[var(--muted)]">
                ไม่มีรูป
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-purple-50">
                {uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูปโปรไฟล์"}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {form.photoUrl && (
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => setForm((prev) => ({ ...prev, photoUrl: null }))}
                >
                  ลบรูป
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">{f.label}</label>
                <input
                  type={f.type ?? "text"}
                  value={(form[f.key] as string | null) ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className={inputClass}
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">จังหวัด</label>
              <input
                list="community-provinces"
                value={form.province}
                onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))}
                className={inputClass}
              />
              <datalist id="community-provinces">
                {THAI_PROVINCES.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">ประเทศ</label>
              <input
                value={form.country}
                placeholder="ประเทศไทย"
                onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">
              แนะนำตัว (ไม่เกิน 2,000 ตัวอักษร)
            </label>
            <textarea
              value={form.bio}
              rows={4}
              maxLength={2000}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              className={inputClass}
            />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex gap-2">
            <Button onClick={() => save.mutate(form)} disabled={save.isPending || uploading}>
              {save.isPending ? "กำลังบันทึก..." : "บันทึกโปรไฟล์ชุมชน"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={save.isPending}>
              ยกเลิก
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
