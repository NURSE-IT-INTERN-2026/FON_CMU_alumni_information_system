"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { AlertTriangle, CheckCircle2, RefreshCw, CloudDownload } from "lucide-react";
import SearchInput from "@/components/ui/search-input";
import { DEGREE_LEVEL_OPTIONS, PAGE_SIZE } from "@/lib/constants";
import { cmuLevelToDegree } from "@/lib/alumni-verify";

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

  // Linked / unlinked split of the local cmu_graduates cache — drives the two
  // tab badges + gates the tables section (hidden pre-first-sync). Reads local
  // data only, so it works even when the Registrar is unreachable.
  const linkCountsQuery = useQuery({
    queryKey: queryKeys.cmuSync.linkCounts(),
    queryFn: () =>
      apiFetch<{ linked: number; unlinked: number }>("/api/cmu-alumni/link-counts"),
  });
  const linkedCount = linkCountsQuery.data?.linked ?? 0;
  const unlinkedCount = linkCountsQuery.data?.unlinked ?? 0;

  const [activeTab, setActiveTab] = useState<"linked" | "unlinked">("linked");
  const showTables = (linkedCount > 0 || unlinkedCount > 0) && !comparing;

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

      {/* Linked vs unlinked tables — only once the local cache is populated. */}
      {showTables && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-[var(--primary)]">
            เปรียบเทียบกับศิษย์เก่าในระบบ
          </h2>
          <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
            ข้อมูลศิษย์เก่าจากระบบทะเบียนที่มีในระบบเราแล้ว และที่ยังไม่มีในระบบ
          </p>

          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab("linked")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "linked"
                  ? "bg-white text-[var(--primary)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              อยู่ในระบบแล้ว ({linkedCount.toLocaleString()})
            </button>
            <button
              onClick={() => setActiveTab("unlinked")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "unlinked"
                  ? "bg-white text-[var(--primary)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              ยังไม่อยู่ในระบบ ({unlinkedCount.toLocaleString()})
            </button>
          </div>

          {/* `key` remounts on tab switch so each tab has independent page/search. */}
          <CmuLinkTable key={activeTab} linkState={activeTab} />
        </div>
      )}
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

// One CMU graduate row as returned by GET /api/cmu-alumni (snake_case shape).
interface CmuGraduateItem {
  student_id: string;
  name_th: string;
  surname_th: string;
  level_id: string;
  major_name_th: string;
  grad_year: string;
}

// Degree enum value → Thai label. `DEGREE_LEVEL_OPTIONS` is the single source of
// truth in constants.ts; build the lookup once at module scope (client-safe).
const DEGREE_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  DEGREE_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
);

function degreeLabel(levelId: string, major: string): string {
  return DEGREE_LEVEL_LABELS[cmuLevelToDegree(levelId, major)] ?? "—";
}

/**
 * Read-only, paginated, searchable table of CMU graduates for one link-state.
 * The two tabs reuse this single component (parameterized by `linkState`); the
 * parent remounts it on tab switch via `key` so each tab keeps its own
 * page/search. Server-side pagination + search hit GET /api/cmu-alumni?linkState.
 */
function CmuLinkTable({ linkState }: { linkState: "linked" | "unlinked" }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = PAGE_SIZE;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.cmuSync.list({ linkState, page, search }),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        linkState,
      });
      if (search) params.set("search", search);
      return apiFetch<{
        data: CmuGraduateItem[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/api/cmu-alumni?${params.toString()}`);
    },
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;

  const applySearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onSearch={applySearch}
          placeholder="ค้นหา รหัสนักศึกษา / ชื่อ / นามสกุล"
          formClassName="w-full sm:max-w-md"
        />
        <span className="text-sm text-[var(--muted)]">
          ทั้งหมด {total.toLocaleString()} รายการ
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-[var(--primary)] text-left text-white">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">ลำดับ</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">รหัสนักศึกษา</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">ชื่อ</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">นามสกุล</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ระดับการศึกษา</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">สาขาวิชา</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">ปีสำเร็จการศึกษา</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {isPending ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">
                  <RefreshCw className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((g, idx) => (
                <tr key={g.student_id || idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-center text-[var(--muted)]">
                    {startIdx + idx + 1}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{g.student_id || "—"}</td>
                  <td className="px-4 py-3">{g.name_th || "—"}</td>
                  <td className="px-4 py-3">{g.surname_th || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {degreeLabel(g.level_id, g.major_name_th)}
                  </td>
                  <td className="px-4 py-3">{g.major_name_th || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{g.grad_year || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row">
          <span className="text-sm text-[var(--muted)]">
            แสดง {total === 0 ? 0 : startIdx + 1}-{Math.min(page * pageSize, total)} จาก{" "}
            {total.toLocaleString()} รายการ
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
            >
              ก่อนหน้า
            </button>
            <span className="text-sm text-[var(--muted)]">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
