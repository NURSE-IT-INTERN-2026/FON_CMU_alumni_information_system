"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { BASE_PATH } from "@/lib/constants";
import { validateImageFile } from "@/lib/upload-limits";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface EventFormValues {
  id?: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  location: string;
  onlineLink: string;
  capacity: string;
  guestLimit: string;
  coverImageUrl: string;
}

const EMPTY: EventFormValues = {
  title: "", description: "", startAt: "", endAt: "",
  location: "", onlineLink: "", capacity: "", guestLimit: "0", coverImageUrl: "",
};

export default function EventFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: EventFormValues | null;
  onSaved: () => void;
}) {
  const editing = !!initial?.id;
  const [form, setForm] = useState<EventFormValues>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof EventFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function uploadCover(file: File) {
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
      }
      const { url } = await res.json();
      setForm((f) => ({ ...f, coverImageUrl: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!form.title.trim()) return setError("กรุณากรอกชื่อกิจกรรม");
    if (!form.startAt) return setError("กรุณาระบุวันเวลาเริ่มกิจกรรม");
    if (form.endAt && form.endAt <= form.startAt) return setError("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น");
    const cap = Number(form.capacity);
    if (!form.capacity.trim() || !Number.isInteger(cap) || cap < 1) {
      return setError("กรุณากรอกจำนวนผู้เข้าร่วมสูงสุด (ตั้งแต่ 1 ขึ้นไป)");
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || "—",
      startAt: form.startAt,
      endAt: form.endAt || undefined,
      location: form.location.trim() || undefined,
      onlineLink: form.onlineLink.trim() || undefined,
      capacity: cap,
      // guestLimit intentionally NOT sent: create defaults to 0; on edit,
      // omitting it leaves a legacy event's per-person guest limit untouched.
      coverImageUrl: form.coverImageUrl || undefined,
    };
    try {
      if (editing) {
        await apiFetch(`/api/events/${initial!.id}`, { method: "PUT", json: payload });
      } else {
        await apiFetch("/api/events", { method: "POST", json: payload });
      }
      onSaved();
      onOpenChange(false);
      setForm(EMPTY);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "แก้ไขกิจกรรม" : "สร้างกิจกรรม"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">ชื่อกิจกรรม <span className="text-red-500">*</span></label>
            <input className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.title} onChange={set("title")} maxLength={200} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">รายละเอียด</label>
            <textarea className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" rows={4} value={form.description} onChange={set("description")} maxLength={10000} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">เริ่ม <span className="text-red-500">*</span></label>
              <input type="datetime-local" className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.startAt} onChange={set("startAt")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">สิ้นสุด</label>
              <input type="datetime-local" className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.endAt} onChange={set("endAt")} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">สถานที่</label>
              <input className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.location} onChange={set("location")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ลิงก์ออนไลน์</label>
              <input className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.onlineLink} onChange={set("onlineLink")} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">จำกัดผู้เข้าร่วม <span className="text-red-500">*</span></label>
            <input type="number" min={1} className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" value={form.capacity} onChange={set("capacity")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">รูปปก</label>
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} className="text-sm" disabled={uploading} />
            {form.coverImageUrl && <p className="mt-1 text-xs text-green-600">อัปโหลดแล้ว</p>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>ยกเลิก</Button>
          <Button onClick={submit} disabled={submitting || uploading}>
            {submitting ? "กำลังบันทึก..." : editing ? "บันทึก" : "สร้างกิจกรรม"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
