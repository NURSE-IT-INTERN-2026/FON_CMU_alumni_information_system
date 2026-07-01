"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { AlertTriangle, CheckCircle2, RefreshCw, CloudDownload } from "lucide-react";

// Shape returned by GET /api/cmu-alumni/sync (the auto-compare).
interface CompareResult {
  remoteCount: number;
  localCount: number;
  newCount: number; // remote studentIds not present locally
  removedCount: number; // local studentIds no longer on remote
  inSync: boolean;
  sample: { studentId: string; name: string; level_id: string; grad_year: string }[];
  lastSyncedAt: string | null;
}

// Shape returned by POST /api/cmu-alumni/sync (the materialize action).
interface SyncResult {
  upserted: number;
  created: number;
  updated: number;
  remoteCount: number;
}

const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function formatThaiDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} น.`;
}

export default function CmuSyncPage() {
  const qc = useQueryClient();
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-compare on load: fetch remote + diff against local cmu_graduates.
  const compareQuery = useQuery({
    queryKey: queryKeys.cmuSync.compare(),
    queryFn: () => apiFetch<CompareResult>("/api/cmu-alumni/sync"),
    retry: false,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiFetch<SyncResult>("/api/cmu-alumni/sync", { method: "POST" }),
    onSuccess: (data) => {
      setSuccessMsg(
        `ดึงข้อมูลสำเร็จ — เพิ่มใหม่ ${data.created.toLocaleString()} / อัปเดต ${data.updated.toLocaleString()} รายการ (รวม ${data.remoteCount.toLocaleString()} รายการ)`,
      );
      setErrorMsg("");
      // Refetch the compare + the now-stale dashboard / alumni views.
      qc.invalidateQueries({ queryKey: queryKeys.cmuSync.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      qc.invalidateQueries({ queryKey: queryKeys.alumni.all });
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : "ดึงข้อมูลไม่สำเร็จ");
      setSuccessMsg("");
    },
  });

  const data = compareQuery.data ?? null;
  const comparing = compareQuery.isPending;
  const syncing = syncMutation.isPending;
  const remoteUnreachable = !!compareQuery.error;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-[var(--primary)]/10 p-2.5 text-[var(--primary)]">
          <CloudDownload className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
            การดึงข้อมูล
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            ตรวจสอบและดึงข้อมูลศิษย์เก่าจากระบบทะเบียนของมหาวิทยาลัย (CMU) เข้าสู่ระบบ
          </p>
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg("")}
            className="text-green-500 hover:text-green-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg("")}
            className="text-red-500 hover:text-red-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Sync-status banner */}
      {comparing ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[var(--muted)]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          กำลังตรวจสอบเทียบกับระบบทะเบียน...
        </div>
      ) : remoteUnreachable ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">ไม่สามารถติดต่อระบบทะเบียนได้ในขณะนี้</p>
            <p className="mt-0.5 text-red-600">
              ไม่สามารถตรวจสอบความตรงกันของข้อมูลได้ กรุณาลองใหม่ภายหลัง
            </p>
          </div>
        </div>
      ) : data && data.localCount === 0 ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">ยังไม่ได้ดึงข้อมูล CMU</p>
            <p className="mt-0.5 text-amber-700">
              กดปุ่ม “ดึงข้อมูล” ด้านล่างเพื่อดึงข้อมูลจากระบบทะเบียนเข้าสู่ระบบเป็นครั้งแรก
            </p>
          </div>
        </div>
      ) : data && data.inSync ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">ข้อมูลตรงกัน</p>
            <p className="mt-0.5 text-green-700">
              ข้อมูลในระบบตรงกับระบบทะเบียน (ดึงข้อมูลล่าสุด {formatThaiDateTime(data.lastSyncedAt)})
            </p>
          </div>
        </div>
      ) : data ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">ข้อมูลไม่ตรงกัน</p>
            <p className="mt-0.5 text-amber-700">
              มีข้อมูลใหม่ {data.newCount.toLocaleString()} รายการ
              {data.removedCount > 0 && ` / ถูกลบจากทะเบียน ${data.removedCount.toLocaleString()} รายการ`} —
              กด “ดึงข้อมูล” เพื่ออัปเดต
            </p>
            {data.sample.length > 0 && (
              <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-auto pl-5 text-amber-700">
                {data.sample.slice(0, 10).map((s) => (
                  <li key={s.studentId}>
                    {s.name || "(ไม่มีชื่อ)"} — {s.studentId}
                    {s.grad_year ? ` (ปี ${s.grad_year})` : ""}
                  </li>
                ))}
                {data.newCount > 10 && <li>…และอีก {(data.newCount - 10).toLocaleString()} รายการ</li>}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="จำนวนในระบบ" value={data?.localCount} muted="รายการที่ดึงเข้าแล้ว" />
        <StatCard label="จำนวนจากทะเบียน" value={data?.remoteCount} muted="CMU Registrar" />
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[var(--muted)]">ดึงข้อมูลล่าสุด</p>
          <p className="mt-2 text-lg font-semibold text-[var(--primary)]">
            {data ? formatThaiDateTime(data.lastSyncedAt) : "—"}
          </p>
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setSuccessMsg("");
            setErrorMsg("");
            syncMutation.mutate();
          }}
          disabled={syncing || comparing || remoteUnreachable}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-light)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <CloudDownload className="h-4 w-4" />
          )}
          {syncing ? "กำลังดึงข้อมูล..." : "ดึงข้อมูล"}
        </button>
        {!syncing && (
          <button
            onClick={() => {
              setSuccessMsg("");
              setErrorMsg("");
              qc.invalidateQueries({ queryKey: queryKeys.cmuSync.compare() });
            }}
            disabled={comparing}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${comparing ? "animate-spin" : ""}`} />
            ตรวจสอบใหม่
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        การดึงข้อมูลจะปรับปรุงข้อมูลศิษย์เก่าในระบบให้ตรงกับระบบทะเบียน
        (อาจใช้เวลาสักครู่สำหรับข้อมูลจำนวนมาก)
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  muted,
}: {
  label: string;
  value: number | undefined;
  muted: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--primary)]">
        {value == null ? "—" : value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">{muted}</p>
    </div>
  );
}
