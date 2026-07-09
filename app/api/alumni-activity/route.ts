import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { withTtlCache } from "@/lib/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { THAI_MONTH_ABBR } from "@/lib/thai-month";

// Alumni-portal engagement analytics. Read-only + 60s-TTL-cached like the
// dashboard route. Two data sources:
//   • Alumni account/engagement fields (passwordHash/accountStatus/hasLoggedIn/
//     lastLoginAt/suspendedAt) for the headline + recency counts.
//   • ActivityLog for login HISTORY — every successful alumni login is logged
//     by /api/alumni-auth/login-email with action = "LOGIN", resource =
//     "alumni_auth". (Pre-2026-07 logins were CREATE + details.action="login";
//     backfilled to LOGIN by scripts/backfill-login-action.ts.) ActivityLog is
//     append-only + indexed on createdAt/alumniId, so it is the correct source
//     for per-month history — NOT Session (sessions are pruned on expiry).
const CACHE_TTL_MS = 60_000;
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok = UTC+7
const DAY_MS = 24 * 60 * 60 * 1000;

interface DegreeMonthRow {
  month: string; // "YYYY-MM" (ICT)
  degreeLevel: string;
  logins: number;
  activeAlumni: number;
}

interface DegreeTotalRow {
  degreeLevel: string;
  active12mo: number;
  logins12mo: number;
}

const DEGREES = [
  "NURSING_ASSISTANT",
  "ASSOCIATE",
  "BACHELOR",
  "MASTER",
  "DOCTORAL",
] as const;

/** ICT wall-clock CE year + 0-based month for a UTC instant. */
function ictYearMonth(d: Date): { y: number; m: number } {
  const s = new Date(d.getTime() + ICT_OFFSET_MS);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth() };
}

function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Thai short label, e.g. "ส.ค. 68" for Aug 2025 (Buddhist 2568). */
function monthLabel(y: number, m: number): string {
  return `${THAI_MONTH_ABBR[m]} ${String(y + 543).slice(-2)}`;
}

/** The 12 ICT months ending at the current month, oldest → newest. */
function buildLast12Months(now: Date): { y: number; m: number }[] {
  const cur = ictYearMonth(now);
  const months: { y: number; m: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    let y = cur.y;
    let m = cur.m - i;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    months.push({ y, m });
  }
  return months;
}

/** Compute (uncached) the full alumni-activity payload. */
async function getAlumniActivity() {
  const now = new Date();
  const months = buildLast12Months(now);
  const first = months[0];
  // UTC instant of midnight ICT on the 1st of the oldest month — the lower
  // bound for the 12-month window (uses the createdAt index).
  const windowStart = new Date(Date.UTC(first.y, first.m, 1) - ICT_OFFSET_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  // "Has an account" = credential-bearing + not soft-deleted, excluding
  // UNVERIFIED (admins don't track that transient pre-email-verification state) —
  // same definition as GET /api/alumni-accounts.
  const accountWhere: Prisma.AlumniWhereInput = {
    passwordHash: { not: null },
    deletedAt: null,
    accountStatus: { not: "UNVERIFIED" },
  };

  const [
    totalAccounts,
    accountStatusGroups,
    totalLogins,
    everLoggedIn,
    suspendedCount,
    recent7,
    recent30,
    degreeMonthRows,
    degreeTotalRows,
  ] = await Promise.all([
    prisma.alumni.count({ where: accountWhere }),

    prisma.alumni.groupBy({
      by: ["accountStatus"],
      _count: true,
      where: accountWhere,
    }),

    // All-time alumni login events (action = LOGIN — see file header).
    prisma.activityLog.count({
      where: {
        actorType: "ALUMNI",
        action: "LOGIN",
        resource: "alumni_auth",
      },
    }),

    prisma.alumni.count({ where: { ...accountWhere, hasLoggedIn: true } }),
    prisma.alumni.count({ where: { ...accountWhere, suspendedAt: { not: null } } }),
    prisma.alumni.count({ where: { ...accountWhere, lastLoginAt: { gte: sevenDaysAgo } } }),
    prisma.alumni.count({ where: { ...accountWhere, lastLoginAt: { gte: thirtyDaysAgo } } }),

    // Per-month + per-degree login totals and DISTINCT active alumni, bucketed
    // by Thai calendar month. INNER JOIN alumni so each login is attributed to
    // its (primary, denormalized) degreeLevel — alumni are soft-deleted so the
    // join always resolves. Within a month the per-degree distinct counts sum
    // exactly to the all-degree total (one degree per alumni), so monthly
    // logins/activeAlumni are derived from this in the reshape below.
    prisma.$queryRaw<DegreeMonthRow[]>`
      SELECT to_char(date_trunc('month', al."createdAt" AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM') AS month,
             a."degreeLevel"::text AS "degreeLevel",
             COUNT(*)::int AS logins,
             COUNT(DISTINCT al."alumniId")::int AS "activeAlumni"
      FROM activity_logs al
      JOIN alumni a ON a.id = al."alumniId"
      WHERE al."actorType" = 'ALUMNI'
        AND al.action = 'LOGIN'
        AND al.resource = 'alumni_auth'
        AND al."createdAt" >= ${windowStart}
      GROUP BY 1, a."degreeLevel"
      ORDER BY 1
    `,

    // Per-degree window totals for the mini cards: distinct alumni active in
    // the 12-month window + total login events, per degree.
    prisma.$queryRaw<DegreeTotalRow[]>`
      SELECT a."degreeLevel"::text AS "degreeLevel",
             COUNT(DISTINCT al."alumniId")::int AS "active12mo",
             COUNT(*)::int AS "logins12mo"
      FROM activity_logs al
      JOIN alumni a ON a.id = al."alumniId"
      WHERE al."actorType" = 'ALUMNI'
        AND al.action = 'LOGIN'
        AND al.resource = 'alumni_auth'
        AND al."createdAt" >= ${windowStart}
      GROUP BY a."degreeLevel"
    `,
  ]);

  // Index per-month-per-degree rows: month -> degree -> {logins, activeAlumni}.
  const byMonthDegree = new Map<
    string,
    Map<string, { logins: number; activeAlumni: number }>
  >();
  for (const r of degreeMonthRows) {
    let dm = byMonthDegree.get(r.month);
    if (!dm) {
      dm = new Map();
      byMonthDegree.set(r.month, dm);
    }
    dm.set(r.degreeLevel, { logins: r.logins, activeAlumni: r.activeAlumni });
  }

  // Zero-fill the 12 months (months/degrees with no logins are absent from
  // GROUP BY). logins/activeAlumni are DERIVED as the sum over degrees.
  const monthly = months.map(({ y, m }) => {
    const key = monthKey(y, m);
    const dm = byMonthDegree.get(key);
    const byDegree: Record<string, { logins: number; activeAlumni: number }> = {};
    let logins = 0;
    let activeAlumni = 0;
    for (const d of DEGREES) {
      const v = dm?.get(d) ?? { logins: 0, activeAlumni: 0 };
      byDegree[d] = v;
      logins += v.logins;
      activeAlumni += v.activeAlumni;
    }
    return {
      month: key,
      label: monthLabel(y, m),
      logins,
      activeAlumni,
      byDegree,
    };
  });

  const degreeTotals: Record<
    string,
    { active12mo: number; logins12mo: number }
  > = {};
  for (const d of DEGREES) degreeTotals[d] = { active12mo: 0, logins12mo: 0 };
  for (const r of degreeTotalRows) {
    degreeTotals[r.degreeLevel] = {
      active12mo: r.active12mo,
      logins12mo: r.logins12mo,
    };
  }

  const statusCounts = Object.fromEntries(
    (accountStatusGroups as { accountStatus: string; _count: number }[]).map(
      (g) => [g.accountStatus, g._count],
    ),
  );

  const cur = months[months.length - 1];
  const currentMonth = monthly[monthly.length - 1];

  return {
    accounts: {
      total: totalAccounts,
      active: statusCounts.ACTIVE ?? 0,
      pending: statusCounts.PENDING ?? 0,
      rejected: statusCounts.REJECTED ?? 0,
      suspended: suspendedCount,
      everLoggedIn,
    },
    logins: { total: totalLogins },
    thisMonth: {
      activeAlumni: currentMonth.activeAlumni,
      logins: currentMonth.logins,
      label: monthLabel(cur.y, cur.m),
    },
    recency: { days7: recent7, days30: recent30 },
    monthly,
    degreeTotals,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const payload = await withTtlCache(
      "alumni-activity",
      CACHE_TTL_MS,
      getAlumniActivity,
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to fetch alumni-activity data:", error);
    return NextResponse.json(
      { error: "Failed to fetch alumni-activity data" },
      { status: 500 },
    );
  }
}
