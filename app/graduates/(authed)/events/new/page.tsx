"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api-client";
import { BASE_PATH } from "@/lib/constants";
import { validateImageFile } from "@/lib/upload-limits";
import { Button } from "@/components/ui/button";

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    location: "",
    onlineLink: "",
    capacity: "",
    guestLimit: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Cover bytes go through the opt-in-alumni upload route (same 5MB/PNG+JPG
  // rules as the admin /api/upload); the URL is attached to the event on POST.
  async function uploadCover(file: File) {
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setUploadingCover(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/alumni-upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
      }
      const { url } = await res.json();
      setCoverUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploadingCover(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.title.trim()) return setError("กรุณากรอกชื่อกิจกรรม");
    if (!form.startAt) return setError("กรุณาระบุวันเวลาเริ่มกิจกรรม");
    if (form.endAt && form.endAt <= form.startAt) return setError("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น");
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>("/api/events", {
        method: "POST",
        json: {
          title: form.title.trim(),
          description: form.description.trim() || "—",
          startAt: form.startAt,
          endAt: form.endAt || undefined,
          location: form.location.trim() || undefined,
          onlineLink: form.onlineLink.trim() || undefined,
          capacity: form.capacity ? Number(form.capacity) : undefined,
          guestLimit: Number(form.guestLimit) || 0,
          coverImageUrl: coverUrl ?? undefined,
        },
      });
      router.push(`/graduates/events/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/graduates/events" className="text-sm text-[var(--muted)] hover:text-[var(--primary)]">
        ← กลับสู่กิจกรรม
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold text-[var(--primary)]" data-tour="events-new-heading">จัดกิจกรรม</h1>

      <div className="space-y-5 rounded-lg bg-white p-6 shadow-sm">
        <div data-tour="events-new-title">
          <label className="mb-1 block text-sm font-medium">ชื่อกิจกรรม <span className="text-red-500">*</span></label>
          <input className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.title} onChange={set("title")} maxLength={200} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">รายละเอียด</label>
          <textarea className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" rows={5} value={form.description} onChange={set("description")} maxLength={10000} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">รูปปก <span className="text-[var(--muted)]">(ไม่บังคับ)</span></label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="text-sm"
            disabled={uploadingCover}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadCover(f);
              e.target.value = "";
            }}
          />
          {uploadingCover && <p className="mt-1 text-xs text-[var(--muted)]">กำลังอัปโหลด...</p>}
          {coverUrl && <p className="mt-1 text-xs text-green-600">อัปโหลดรูปปกแล้ว</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div data-tour="events-new-datetime">
            <label className="mb-1 block text-sm font-medium">เริ่ม <span className="text-red-500">*</span></label>
            <input type="datetime-local" className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.startAt} onChange={set("startAt")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">สิ้นสุด</label>
            <input type="datetime-local" className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.endAt} onChange={set("endAt")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div data-tour="events-new-location">
            <label className="mb-1 block text-sm font-medium">สถานที่</label>
            <input className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.location} onChange={set("location")} placeholder="เช่น ห้องประชุม 200 ปี มช." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">ลิงก์ออนไลน์ <span className="text-[var(--muted)]">(ไม่บังคับ)</span></label>
            <input className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.onlineLink} onChange={set("onlineLink")} placeholder="https://…" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div data-tour="events-new-capacity">
            <label className="mb-1 block text-sm font-medium">จำกัดผู้เข้าร่วม <span className="text-[var(--muted)]">(ไม่บังคับ)</span></label>
            <input type="number" min={1} className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.capacity} onChange={set("capacity")} placeholder="รวมผู้ร่วมเดินทาง" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">ผู้ร่วมเดินทางสูงสุด/ท่าน</label>
            <input type="number" min={0} className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.guestLimit} onChange={set("guestLimit")} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Link href="/graduates/events"><Button variant="outline" disabled={submitting}>ยกเลิก</Button></Link>
          <Button onClick={submit} disabled={submitting || uploadingCover}>{submitting ? "กำลังบันทึก..." : "สร้างกิจกรรม"}</Button>
        </div>
      </div>
    </div>
  );
}
