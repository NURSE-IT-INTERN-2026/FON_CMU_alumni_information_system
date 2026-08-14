"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useCanWrite } from "@/lib/role-context";
import { Button } from "@/components/ui/button";

/**
 * Staff announcements for the alumni community (V2) — plain textarea CRUD
 * (no Tiptap; that's News). Executive read-only via useCanWrite (server
 * enforces via checkWritePermission). Pin floats to top; optional expiry.
 */

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  pinnedAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  authorUser: { id: string; firstName: string; lastName: string } | null;
}

const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}

const inputClass = "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm";

export default function AnnouncementsManagementPage() {
  const qc = useQueryClient();
  const canWrite = useCanWrite();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", pinned: false, expiresAt: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Admin view: include expired (flagged) — this is the management list.
  const { data, isPending } = useQuery({
    queryKey: queryKeys.announcements.adminList(),
    queryFn: () => apiFetch<{ data: AnnouncementItem[] }>("/api/announcements"),
  });
  const announcements = data?.data ?? [];

  function openCreate() {
    setEditId(null);
    setForm({ title: "", body: "", pinned: false, expiresAt: "" });
    setFormError(null);
    setShowForm(true);
  }
  function openEdit(a: AnnouncementItem) {
    setEditId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      pinned: !!a.pinnedAt,
      expiresAt: a.expiresAt ? new Date(new Date(a.expiresAt).getTime() - 7 * 3600000).toISOString().slice(0, 16) : "",
    });
    setFormError(null);
    setShowForm(true);
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        pinned: form.pinned,
        expiresAt: form.expiresAt || undefined,
      };
      return editId
        ? apiFetch(`/api/announcements/${editId}`, { method: "PUT", json: payload })
        : apiFetch("/api/announcements", { method: "POST", json: payload });
    },
    onSuccess: () => {
      setShowForm(false);
      setFormError(null);
      qc.invalidateQueries({ queryKey: queryKeys.announcements.adminList() });
      qc.invalidateQueries({ queryKey: queryKeys.announcements.all });
    },
    onError: (e) => setFormError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการบันทึก"),
  });

  const togglePin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      apiFetch(`/api/announcements/${id}`, { method: "PUT", json: { pinned } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.announcements.adminList() });
      qc.invalidateQueries({ queryKey: queryKeys.announcements.all });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: queryKeys.announcements.adminList() });
      qc.invalidateQueries({ queryKey: queryKeys.announcements.all });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">ประกาศชุมชนศิษย์เก่า</h1>
          <p className="text-sm text-[var(--muted)]">ประกาศสั้นถึงสมาชิกชุมชนศิษย์เก่า (แยกจากหน้าข่าวสาร)</p>
        </div>
        {canWrite && <Button onClick={openCreate}>เพิ่มประกาศ</Button>}
      </div>

      {isPending ? (
        <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm"><p className="text-[var(--muted)]">ยังไม่มีประกาศ</p></div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
            return (
              <div key={a.id} className={`rounded-lg bg-white p-5 shadow-sm ${a.pinnedAt ? "border-l-4 border-[var(--accent)]" : ""}`}>
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">
                      {a.pinnedAt && <span className="mr-2 text-[var(--accent)]">📌</span>}
                      {a.title}
                      {expired && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[var(--muted)]">หมดอายุแล้ว</span>}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {formatThaiDate(a.createdAt)}
                      {a.expiresAt && ` · หมดอายุ ${formatThaiDate(a.expiresAt)}`}
                      {a.authorUser && ` · โดย ${a.authorUser.firstName} ${a.authorUser.lastName}`}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="ghost" size="sm" onClick={() => togglePin.mutate({ id: a.id, pinned: !a.pinnedAt })}>
                        {a.pinnedAt ? "เลิกปักหมุด" : "ปักหมุด"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>แก้ไข</Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleteId(a.id)}>ลบ</Button>
                    </div>
                  )}
                </div>
                <p className="whitespace-pre-line text-sm">{a.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/edit form dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{editId ? "แก้ไขประกาศ" : "เพิ่มประกาศ"}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">หัวข้อ *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">เนื้อหา * (ข้อความธรรมดา)</label>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} maxLength={5000} className={inputClass} />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                  ปักหมุดไว้ด้านบน
                </label>
                <div className="flex flex-1 items-center gap-2">
                  <label className="text-xs font-medium text-[var(--primary-dark)]">หมดอายุ (ไม่บังคับ)</label>
                  <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="flex-1 rounded-md border border-[var(--border)] px-2 py-1.5 text-sm" />
                </div>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowForm(false)} disabled={save.isPending}>ยกเลิก</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.body.trim()}>
                  {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold">ลบประกาศ</h3>
            <p className="mb-4 text-sm text-[var(--muted)]">ท่านแน่ใจหรือไม่ว่าต้องการลบประกาศนี้ (ผู้ดูแลระบบสามารถกู้คืนจากถังขยะได้)</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={remove.isPending}>ยกเลิก</Button>
              <Button variant="destructive" onClick={() => remove.mutate(deleteId)} disabled={remove.isPending}>
                {remove.isPending ? "กำลังลบ..." : "ลบประกาศ"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
