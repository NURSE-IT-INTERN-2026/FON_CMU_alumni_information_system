"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch, ApiError } from "@/lib/api-client";
import SearchInput from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import ForumBody from "@/components/forum/ForumBody";
import ReportDialog from "@/components/forum/ReportDialog";
import PhotoAvatar from "@/components/forum/PhotoAvatar";
import { THAI_PROVINCES } from "@/lib/thai-provinces";
import { JOBS_DEFAULT_COUNTRY, isThailandFilter } from "@/lib/job-country";
import { JOB_SCOPE_VALUES, JOB_SCOPE_LABELS } from "@/lib/validations";
import { isoToDatetimeLocal } from "@/lib/event-format";
import type { AlumniPublicIdentity } from "@/lib/forum-identity";

const JOBS_PAGE_SIZE = 10;

const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}

type Author =
  | ({ type: "alumni" } & AlumniPublicIdentity)
  | { type: "staff"; id: string; name: string }
  | null;

interface JobItem {
  id: string;
  title: string;
  workplace: string;
  position: string | null;
  province: string | null;
  country: string | null;
  description: string;
  applyUrl: string | null;
  contactInfo: string | null;
  expiresAt: string;
  createdAt: string;
  authorAlumniId: string | null;
  author: Author;
  expired: boolean;
}
interface Paged<T> {
  data: T[];
  total: number;
  totalPages: number;
}
interface JobsResponse extends Paged<JobItem> {
  /** Distinct non-Thai countries on live posts (for the country filter). */
  countries: string[];
}

const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm";

export default function AlumniJobsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState(JOBS_DEFAULT_COUNTRY);
  const [province, setProvince] = useState("");
  const [scope, setScope] = useState<string>("active");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", workplace: "", province: "", country: "",
    description: "", applyUrl: "", contactInfo: "",
    expiresAt: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const reportOpen = reportId !== null;

  const { data: membership } = useQuery({
    queryKey: queryKeys.forum.membership(),
    queryFn: () => apiFetch<{ optedIn: boolean; alumniId: string }>("/api/alumni-profile/community-membership"),
  });
  const myId = membership?.alumniId;
  const optedIn = membership?.optedIn ?? false;

  const { data: jobsData, isPending: loading, isError } = useQuery({
    queryKey: queryKeys.jobs.list({ page, search, province, scope, country }),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(JOBS_PAGE_SIZE), scope,
      });
      if (search) params.set("search", search);
      if (country) params.set("country", country);
      if (province) params.set("province", province);
      return apiFetch<JobsResponse>(`/api/jobs?${params}`);
    },
  });

  const jobs = jobsData?.data ?? [];
  const totalPages = jobsData?.totalPages ?? 1;
  const countries = jobsData?.countries ?? [];
  const thailand = isThailandFilter(country);

  const create = useMutation({
    mutationFn: () => apiFetch("/api/jobs", { method: "POST", json: form }),
    onSuccess: () => {
      setShowCreate(false);
      setFormError(null);
      setForm({ ...form, title: "", workplace: "", description: "", applyUrl: "", contactInfo: "" });
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (e) => setFormError(e instanceof ApiError ? e.message : "เกิดข้อผิดพลาดในการลงประกาศ"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl" data-tour="jobs-heading">ประกาศงาน</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">โอกาสทางอาชีพจากศิษย์เก่าและคณะ</p>
        </div>
        {/* Staff OR opted-in alumni may post (server decides; non-opted-in gets 403).
            Default expiry = 30 days out, computed on open (not during render). */}
        <span data-tour="jobs-create">
        <Button
          onClick={() => {
            setForm({ ...form, expiresAt: isoToDatetimeLocal(new Date(Date.now() + 30 * 86400000).toISOString()) });
            setShowCreate(true);
          }}
        >
          ลงประกาศงาน
        </Button>
        </span>
      </div>

      {/* Search + filters */}
      <div className="mb-6 space-y-3" data-tour="jobs-filters">
        <SearchInput value={search} onSearch={(v) => { setSearch(v); setPage(1); }} placeholder="ค้นหาตำแหน่ง สถานที่ทำงาน..." formClassName="w-full" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={country}
            onChange={(e) => { setCountry(e.target.value); setProvince(""); setPage(1); }}
            className={`${inputClass} sm:w-44`}
            aria-label="ประเทศ"
          >
            <option value="">ทุกประเทศ</option>
            <option value={JOBS_DEFAULT_COUNTRY}>{JOBS_DEFAULT_COUNTRY}</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {thailand ? (
            <select
              value={province}
              onChange={(e) => { setProvince(e.target.value); setPage(1); }}
              className={`${inputClass} sm:w-56`}
              aria-label="จังหวัด"
            >
              <option value="">ทุกจังหวัด</option>
              {THAI_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <input
              value={province}
              onChange={(e) => { setProvince(e.target.value); setPage(1); }}
              placeholder="จังหวัด/รัฐ"
              aria-label="จังหวัด/รัฐ"
              className={`${inputClass} sm:w-56`}
            />
          )}
          <select value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }} className={`${inputClass} sm:w-44`}>
            {JOB_SCOPE_VALUES.map((s) => <option key={s} value={s}>{JOB_SCOPE_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16" data-tour="jobs-list"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" /></div>
      ) : isError ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm" data-tour="jobs-list"><p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p></div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm" data-tour="jobs-list"><p className="text-[var(--muted)]">ยังไม่มีประกาศงาน</p></div>
      ) : (
        <div className="space-y-3" data-tour="jobs-list">
          {jobs.map((j) => (
            <div key={j.id} className="rounded-lg bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{j.title}</h3>
                  <p className="text-sm text-[var(--primary-dark)]">
                    {j.workplace}
                    {j.position && ` · ${j.position}`}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {[j.province, j.country].filter(Boolean).join(", ")}
                    {" · "}ปิดรับสมัคร {formatThaiDate(j.expiresAt)}
                  </p>
                </div>
                {j.expired && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-[var(--muted)]">ปิดรับสมัครแล้ว</span>
                )}
              </div>
              <ForumBody text={j.description} />
              {(j.applyUrl || j.contactInfo) && (
                <div className="mt-3 space-y-1 text-sm">
                  {j.applyUrl && (
                    <p>📩 สมัคร:{" "}
                      <a href={j.applyUrl} target="_blank" rel="noreferrer" className="break-all text-[var(--primary)] hover:underline">{j.applyUrl}</a>
                    </p>
                  )}
                  {j.contactInfo && <p className="whitespace-pre-line">☎️ ติดต่อ: {j.contactInfo}</p>}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
                {j.author?.type === "alumni" ? (
                  <PhotoAvatar identity={j.author} size="sm" />
                ) : j.author?.type === "staff" ? (
                  <span className="text-xs text-[var(--muted)]">เจ้าหน้าที่: {j.author.name}</span>
                ) : (
                  <span className="text-xs text-[var(--muted)]">—</span>
                )}
                <div className="flex items-center gap-3 text-xs">
                  {optedIn && j.authorAlumniId !== myId && (
                    <button onClick={() => setReportId(j.id)} className="text-[var(--muted)] hover:text-red-600 hover:underline">รายงาน</button>
                  )}
                  {(j.authorAlumniId === myId || !optedIn) && (
                    <button onClick={() => setDeleteId(j.id)} className="text-red-600 hover:underline">ลบ</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
          <span className="text-sm text-[var(--muted)]">หน้า {page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
        </div>
      )}

      {/* Report dialog */}
      <ReportDialog
        resourceType="JOB_POSTING"
        resourceId={reportId ?? ""}
        open={reportOpen}
        onOpenChange={(open) => { if (!open) setReportId(null); }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        title="ลบประกาศงาน"
        description="ท่านแน่ใจหรือไม่ว่าต้องการลบประกาศงานนี้"
        confirmLabel="ลบประกาศ"
        onConfirm={() => { if (deleteId) remove.mutate(deleteId); }}
        loading={remove.isPending}
      />

      {/* Create dialog */}
      {showCreate && (
        <Modal
          open
          onOpenChange={(o) => { if (!o) setShowCreate(false); }}
          title="ลงประกาศงาน"
          size="md"
          scrollBody
          showCloseButton={false}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={create.isPending}>ยกเลิก</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !form.title.trim() || !form.workplace.trim() || !form.description.trim()}>
                {create.isPending ? "กำลังลงประกาศ..." : "ลงประกาศ"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">ตำแหน่งงาน *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">สถานที่ทำงาน *</label>
                <input value={form.workplace} onChange={(e) => setForm({ ...form, workplace: e.target.value })} maxLength={200} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">จังหวัด</label>
                  <input list="jobs-create-provinces" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className={inputClass} />
                  <datalist id="jobs-create-provinces">{THAI_PROVINCES.map((p) => <option key={p} value={p} />)}</datalist>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">ประเทศ</label>
                  <input value={form.country} placeholder="ประเทศไทย" onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">รายละเอียดงาน *</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={10000} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">ลิงก์สมัคร</label>
                  <input type="url" value={form.applyUrl} onChange={(e) => setForm({ ...form, applyUrl: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">ข้อมูลติดต่อ</label>
                  <input value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} maxLength={500} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--primary-dark)]">วันที่ปิดรับสมัคร *</label>
                <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inputClass} />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
