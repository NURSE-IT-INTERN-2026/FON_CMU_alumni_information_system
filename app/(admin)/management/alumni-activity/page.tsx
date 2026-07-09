"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  Ban,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types — matches the GET /api/alumni-activity response shape.
// ---------------------------------------------------------------------------

interface MonthlyPoint {
  month: string; // "YYYY-MM"
  label: string; // "ส.ค. 68"
  logins: number;
  activeAlumni: number;
}

interface AlumniActivityData {
  accounts: {
    total: number;
    active: number;
    pending: number;
    rejected: number;
    suspended: number;
    everLoggedIn: number;
  };
  logins: { total: number };
  thisMonth: { activeAlumni: number; logins: number; label: string };
  recency: { days7: number; days30: number };
  monthly: MonthlyPoint[];
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const COLOR = {
  primary: "#5b21b6", // accounts
  teal: "#0d9488", // logins / month line
  emerald: "#059669", // this-month active
  amber: "#ca8a04", // pending
  green: "#16a34a", // active status
  red: "#dc2626", // rejected / suspended
  slate: "#475569", // recency neutrals
};

// ---------------------------------------------------------------------------
// Small building blocks (mirror the dashboard's card / pill styling)
// ---------------------------------------------------------------------------

function StatusPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color}15`, color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {count.toLocaleString()} {label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  unit,
  color,
  icon,
  footer,
}: {
  label: string;
  value: number;
  unit?: string;
  color: string;
  icon: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border-l-4 bg-white p-5 shadow-sm"
      style={{ borderLeftColor: color }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}10`, color }}
      >
        {icon}
      </div>
      <p className="mt-3 text-xs font-medium text-[var(--muted)]">{label}</p>
      <p
        className="mt-1 text-2xl font-bold sm:text-3xl"
        style={{ color }}
      >
        {value.toLocaleString()}
        {unit ? (
          <>
            {" "}
            <span className="text-base font-normal text-[var(--muted)]">
              {unit}
            </span>
          </>
        ) : null}
      </p>
      {footer}
    </div>
  );
}

function LineChartCard({
  title,
  data,
  dataKey,
  color,
  unit,
  ready,
}: {
  title: string;
  data: MonthlyPoint[];
  dataKey: "activeAlumni" | "logins";
  color: string;
  unit: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-[var(--muted)]">12 เดือนที่ผ่านมา</p>
      {ready ? (
        <div className="mt-4 h-[280px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => `${Number(value).toLocaleString()} ${unit}`}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlumniActivityPage() {
  const [chartReady, setChartReady] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.alumniActivity.stats(),
    queryFn: () => apiFetch<AlumniActivityData>("/api/alumni-activity"),
  });

  const data = query.data ?? null;
  const loading = query.isPending;
  const error = query.error?.message || null;

  // Defer chart render by one frame so the container has real dimensions
  // before ResponsiveContainer tries to measure it (avoids recharts'
  // "width(-1) and height(-1)" warning).
  useEffect(() => {
    const id = requestAnimationFrame(() => setChartReady(!!data));
    return () => cancelAnimationFrame(id);
  }, [data]);

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
          <p className="text-red-600">{error || "ไม่สามารถโหลดข้อมูลได้"}</p>
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

  const activationRate =
    data.accounts.total > 0
      ? Math.round((data.accounts.everLoggedIn / data.accounts.total) * 100)
      : 0;

  // ---- Main content ----
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          สถิติการใช้งานศิษย์เก่า
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          ภาพรวมบัญชีศิษย์เก่าและการเข้าใช้งานระบบ (ข้อมูลอ้างอิงเดือน {data.thisMonth.label})
        </p>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="บัญชีศิษย์เก่าทั้งหมด"
          value={data.accounts.total}
          unit="บัญชี"
          color={COLOR.primary}
          icon={<Users className="h-5 w-5" />}
          footer={
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusPill count={data.accounts.active} label="ใช้งาน" color={COLOR.green} />
              <StatusPill count={data.accounts.pending} label="รออนุมัติ" color={COLOR.amber} />
              <StatusPill count={data.accounts.rejected} label="ปฏิเสธ" color={COLOR.red} />
            </div>
          }
        />

        <KpiCard
          label="ศิษย์เก่าที่ใช้งานเดือนนี้"
          value={data.thisMonth.activeAlumni}
          unit="คน"
          color={COLOR.emerald}
          icon={<UserCheck className="h-5 w-5" />}
          footer={
            <p className="mt-2 text-xs text-[var(--muted)]">{data.thisMonth.label}</p>
          }
        />

        <KpiCard
          label="การเข้าสู่ระบบเดือนนี้"
          value={data.thisMonth.logins}
          unit="ครั้ง"
          color={COLOR.teal}
          icon={<TrendingUp className="h-5 w-5" />}
          footer={
            <p className="mt-2 text-xs text-[var(--muted)]">{data.thisMonth.label}</p>
          }
        />
      </div>

      {/* Line graphs */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LineChartCard
          title="จำนวนศิษย์เก่าที่ใช้งานต่อเดือน"
          data={data.monthly}
          dataKey="activeAlumni"
          color={COLOR.emerald}
          unit="คน"
          ready={chartReady}
        />
        <LineChartCard
          title="จำนวนการเข้าสู่ระบบต่อเดือน"
          data={data.monthly}
          dataKey="logins"
          color={COLOR.teal}
          unit="ครั้ง"
          ready={chartReady}
        />
      </div>

      {/* Engagement recency */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[var(--primary)]">
          การมีส่วนร่วมล่าสุด
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="เข้าระบบใน 7 วันที่แล้ว"
            value={data.recency.days7}
            unit="คน"
            color={COLOR.slate}
            icon={<Clock className="h-5 w-5" />}
          />
          <KpiCard
            label="เข้าระบบใน 30 วันที่แล้ว"
            value={data.recency.days30}
            unit="คน"
            color={COLOR.slate}
            icon={<Clock className="h-5 w-5" />}
          />
          <KpiCard
            label="เคยเข้าระบบ"
            value={data.accounts.everLoggedIn}
            unit="คน"
            color={COLOR.green}
            icon={<UserCheck className="h-5 w-5" />}
            footer={
              <p className="mt-2 text-xs text-[var(--muted)]">
                {activationRate}% ของบัญชีทั้งหมด
              </p>
            }
          />
          <KpiCard
            label="ระงับการใช้งาน"
            value={data.accounts.suspended}
            unit="บัญชี"
            color={COLOR.red}
            icon={<Ban className="h-5 w-5" />}
          />
        </div>
      </section>
    </div>
  );
}
