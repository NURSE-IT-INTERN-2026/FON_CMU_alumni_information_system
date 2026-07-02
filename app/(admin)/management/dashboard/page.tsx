"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { assetUrl } from "@/lib/asset-url";
import { DEGREE_COLORS } from "@/lib/constants";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, User } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatThaiDate(date: Date): string {
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const d = new Date(date);
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

/** A small colored count pill for the alumni-accounts status strip. */
function StatusPill({
  count,
  label,
  color,
  dot = false,
}: {
  count: number;
  label: string;
  color: string;
  dot?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {dot && (
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {count.toLocaleString()} {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  // false when the CMU Registrar was unreachable — alumni totals then reflect
  // local rows only (lower than normal); the page shows a warning banner.
  cmuAvailable: boolean;
  alumni: {
    total: number;
    byDegreeLevel: Record<string, number>;
    degreeBreakdown: string;
  };
  // Signup-account counts by status (credential-bearing, non-deleted) — drives
  // the "pending approvals" card.
  alumniAccounts: {
    pending: number;
    active: number;
    rejected: number;
  };
  awards: {
    total: number;
    latestYear: number | null;
    latestYearCount: number;
    byType: Record<string, number>;
  };
  potentials: {
    total: number;
    latestYear: number | null;
    latestYearCount: number;
  };
  associations: {
    total: number;
    distinctAssociationCount: number;
  };
  graduateCommittee: {
    total: number;
    latestTermYear: number | null;
    latestTermYearCount: number;
  };
  modelRepresentatives: {
    total: number;
    distinctCohorts: number;
  };
  alumniAgency: {
    total: number;
    distinctCountries: number;
  };
  news: {
    total: number;
    publishedCount: number;
  };
  recentNews: Array<{
    id: string;
    title: string;
    coverImageUrl: string | null;
    publishedAt: string | null;
    body: string;
  }>;
}

// ---------------------------------------------------------------------------
// Chart types & constants
// ---------------------------------------------------------------------------

interface ChartSeries {
  key: string;
  label: string;
  data: number[];
}

interface ChartData {
  generations: string[];
  series: ChartSeries[];
  cmuAvailable: boolean;
}

// Degree-level colors are shared via DEGREE_COLORS (@/lib/constants) so the
// education cards on the profile pages match the dashboard graph. Order here
// follows the lowest→highest degree sequence used by the chart series.
const DEGREE_ORDER = ["NURSING_ASSISTANT", "ASSOCIATE", "BACHELOR", "MASTER", "DOCTORAL"];
const SERIES_COLORS = DEGREE_ORDER.map((k) => DEGREE_COLORS[k]);

// ---------------------------------------------------------------------------
// Card config
// ---------------------------------------------------------------------------

interface CardConfig {
  label: string;
  href: string;
  color: string;
  icon: React.ReactNode;
  getCount: (d: DashboardData) => number;
}

const DEGREE_MINI_CARDS = [
  { key: "NURSING_ASSISTANT", label: "ผู้ช่วยพยาบาล", color: DEGREE_COLORS.NURSING_ASSISTANT },
  { key: "ASSOCIATE", label: "อนุปริญญา", color: DEGREE_COLORS.ASSOCIATE },
  { key: "BACHELOR", label: "ปริญญาตรี", color: DEGREE_COLORS.BACHELOR },
  { key: "MASTER", label: "ปริญญาโท", color: DEGREE_COLORS.MASTER },
  { key: "DOCTORAL", label: "ปริญญาเอก", color: DEGREE_COLORS.DOCTORAL },
];

// PRD §3.2: awards summary on the dashboard, grouped by type (in this order).
const AWARD_TYPE_MINI_CARDS = [
  { key: "LOCAL", label: "ระดับท้องถิ่น", color: "#38a169" },
  { key: "NATIONAL", label: "ระดับชาติ", color: "#f57f17" },
  { key: "INTERNATIONAL", label: "ระดับนานาชาติ", color: "#1565c0" },
];

const CARDS: CardConfig[] = [
  {
    label: "ศักยภาพ",
    href: "/management/potentials",
    color: "#38a169",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    getCount: (d) => d.potentials.total,
  },
  {
    label: "สมาคม/ชมรม",
    href: "/management/associations",
    color: "#6a1b9a",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
    getCount: (d) => d.associations.total,
  },
  {
    label: "กรรมการบัณฑิต",
    href: "/management/graduate-committee",
    color: "#00838f",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
      </svg>
    ),
    getCount: (d) => d.graduateCommittee.total,
  },
  {
    label: "ผู้แทนรุ่น",
    href: "/management/model-representatives",
    color: "#c62828",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    ),
    getCount: (d) => d.modelRepresentatives.total,
  },
  {
    label: "ต้นสังกัดศิษย์เก่า",
    href: "/management/alumni-agency",
    color: "#1565c0",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.466.732-3.558" />
      </svg>
    ),
    getCount: (d) => d.alumniAgency.total,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [chartReady, setChartReady] = useState(false);

  const statsQuery = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => apiFetch<DashboardData>("/api/dashboard"),
  });
  const chartQuery = useQuery({
    queryKey: queryKeys.dashboard.chart(),
    queryFn: () => apiFetch<ChartData>("/api/alumni-count"),
  });
  const data = statsQuery.data ?? null;
  const chartData = chartQuery.data ?? null;
  const loading = statsQuery.isPending || chartQuery.isPending;
  const error = statsQuery.error?.message || chartQuery.error?.message || null;
  // CMU Registrar availability — either endpoint reports it. Default to true
  // (optimistic) so no warning flashes before data loads (loading returns early).
  const cmuAvailable =
    statsQuery.data?.cmuAvailable ?? chartQuery.data?.cmuAvailable ?? true;

  // Defer chart render by one frame so the container has real dimensions
  // before ResponsiveContainer tries to measure it. This avoids the
  // "width(-1) and height(-1)" warning from recharts. The setChartReady call
  // lives in the rAF callback (not the effect body) so it isn't a
  // setState-in-effect.
  useEffect(() => {
    const id = requestAnimationFrame(() => setChartReady(!!chartData));
    return () => cancelAnimationFrame(id);
  }, [chartData]);

  const rechartsData = useMemo(
    () =>
      chartData?.generations.map((gen, gi) => {
        const point: Record<string, string | number> = { year: gen };
        for (const s of chartData.series) {
          point[s.key] = s.data[gi] || 0;
        }
        return point;
      }) ?? [],
    [chartData]
  );

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-10 w-10 animate-spin text-[var(--primary)]"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-[var(--muted)]">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-center">
          <p className="text-red-600">
            {error || "ไม่สามารถโหลดข้อมูลได้"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-md bg-[var(--primary)] px-4 py-2 text-sm text-white hover:bg-[var(--primary-light)]"
          >
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  // ---- Main content ----
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          แผงควบคุม
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          ภาพรวมข้อมูลระบบสารสนเทศศิษย์เก่า คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
        </p>
      </div>

      {/* CMU data not yet synced — alumni totals then reflect local rows only. */}
      {!cmuAvailable && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">ยังไม่ได้ดึงข้อมูล CMU</p>
            <p className="mt-0.5 text-amber-700">
              จำนวนศิษย์เก่าแสดงเฉพาะที่บันทึกในระบบเท่านั้น —{" "}
              <Link href="/management/settings/cmu-sync" className="underline hover:text-amber-900">
                ดึงข้อมูลจากระบบทะเบียน
              </Link>{" "}
              เพื่อแสดงผลครบถ้วน
            </p>
          </div>
        </div>
      )}

      {/* Pending alumni accounts — summary banner. Purple left border + purple
          circular arrow; whole card opens the approval queue. Pills are colored
          by status: yellow=pending, green=active, red=rejected. */}
      <Link
        href="/management/settings/users?status=pending"
        className="group mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border-l-4 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        style={{ borderLeftColor: "#5b21b6" }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#5b21b610] p-2 text-[#5b21b6]">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">บัญชีศิษย์เก่า</p>
            <p className="text-xs text-gray-500">ตรวจสอบและจัดการบัญชีผู้ใช้ศิษย์เก่า</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill count={data.alumniAccounts.pending} label="รออนุมัติ" color="#ca8a04" />
          <StatusPill count={data.alumniAccounts.active} label="ใช้งาน" color="#16a34a" />
          <StatusPill count={data.alumniAccounts.rejected} label="ปฏิเสธ" color="#dc2626" />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5b21b6] text-white transition-transform group-hover:translate-x-0.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </div>
      </Link>

      {/* Featured Alumni Count Card */}
      <Link
        href="/management/all-alumni"
        className="group mb-4 block rounded-xl border-l-4 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-8"
        style={{ borderLeftColor: "#5b21b6" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2.5" style={{ backgroundColor: "#5b21b610", color: "#5b21b6" }}>
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">จำนวนนักศึกษาเก่าทั้งหมด</p>
              <p className="text-3xl font-bold text-[#5b21b6] sm:text-4xl">
                {data.alumni.total.toLocaleString()} <span className="text-base font-normal text-[var(--muted)]">คน</span>
              </p>
            </div>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5b21b6] text-white transition-transform group-hover:translate-x-0.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {DEGREE_MINI_CARDS.map((deg) => (
            <div
              key={deg.key}
              className="rounded-lg p-3"
              style={{ backgroundColor: `${deg.color}08`, borderTop: `3px solid ${deg.color}` }}
            >
              <p className="text-xs text-[var(--muted)]">{deg.label}</p>
              <p className="mt-0.5 text-lg font-bold" style={{ color: deg.color }}>
                {(data.alumni.byDegreeLevel[deg.key] ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Alumni count line chart */}
        {chartReady && (
          <div className="mt-5" onClick={(e) => e.preventDefault()}>
            <div className="h-[280px] sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rechartsData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 12 }}
                    label={{ value: "ปีที่จบ", position: "insideBottom", offset: -2, fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    label={{ value: "จำนวน", angle: -90, position: "insideLeft", fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const series = chartData!.series.find((s) => s.key === name);
                      return [`${value} คน`, series?.label ?? String(name)];
                    }}
                  />
                  {chartData!.series.map((s, i) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {chartData!.series.map((s, i) => (
                <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </Link>

      {/* Awards summary grouped by type (PRD §3.2) */}
      <Link
        href="/management/awards"
        className="group mb-4 block rounded-xl border-l-4 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-8"
        style={{ borderLeftColor: "#e8a838" }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: "#e8a83810", color: "#e8a838" }}>
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-4.5A3.375 3.375 0 0 0 13.125 10.875h-2.25A3.375 3.375 0 0 0 7.5 14.25v4.5m6-15a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--muted)]">รางวัลทั้งหมด</p>
            <p className="text-3xl font-bold text-[#e8a838] sm:text-4xl">
              {data.awards.total.toLocaleString()} <span className="text-base font-normal text-[var(--muted)]">รายการ</span>
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {AWARD_TYPE_MINI_CARDS.map((t) => (
            <div
              key={t.key}
              className="rounded-lg p-3"
              style={{ backgroundColor: `${t.color}08`, borderTop: `3px solid ${t.color}` }}
            >
              <p className="text-xs text-[var(--muted)]">{t.label}</p>
              <p className="mt-0.5 text-lg font-bold" style={{ color: t.color }}>
                {(data.awards.byType[t.key] ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </Link>

      {/* Dashboard Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {CARDS.map((card) => {
          const count = card.getCount(data);

          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-xl border-l-4 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderLeftColor: card.color }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="rounded-lg p-2"
                  style={{ backgroundColor: `${card.color}10`, color: card.color }}
                >
                  {card.icon}
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-[var(--muted)]">
                {card.label}
              </p>
              <p
                className="mt-1 text-2xl font-bold sm:text-3xl"
                style={{ color: card.color }}
              >
                {count.toLocaleString()}{" "}
                <span className="text-base font-normal text-[var(--muted)]">รายการ</span>
              </p>
            </Link>
          );
        })}
      </div>

      {/* Recent News Section */}
      <section className="mt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-[var(--primary)]">
            ข่าวสารล่าสุด
          </h2>
          <Link
            href="/management/news"
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-light)]"
          >
            ดูทั้งหมด
          </Link>
        </div>

        {data.recentNews.length === 0 ? (
          <div className="rounded-lg bg-white py-12 text-center shadow-sm">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-[var(--muted)]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <p className="text-[var(--muted)]">ยังไม่มีข่าวสาร</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentNews.map((item) => {
              const summary = stripHtml(item.body).slice(0, 150);
              return (
                <Link
                  key={item.id}
                  href={`/news/${item.id}`}
                  className="group overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="aspect-video w-full overflow-hidden bg-gray-100">
                    {item.coverImageUrl ? (
                      <img
                        src={assetUrl(item.coverImageUrl)}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[var(--primary)]/5">
                        <svg
                          className="h-12 w-12 text-[var(--primary)]/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="mb-2 line-clamp-2 text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                      {item.title}
                    </h3>
                    <p className="mb-2 text-xs text-[var(--muted)]">
                      {item.publishedAt
                        ? formatThaiDate(new Date(item.publishedAt))
                        : ""}
                    </p>
                    {summary && (
                      <p className="line-clamp-3 text-sm text-[var(--muted)]">
                        {summary}
                        {stripHtml(item.body).length > 150 ? "..." : ""}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
