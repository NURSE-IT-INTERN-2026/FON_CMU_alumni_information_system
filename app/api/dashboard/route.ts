import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPersonDegreeBreakdown } from "@/lib/person-degree-count";
import { withTtlCache } from "@/lib/cache";

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
  ASSOCIATE: "อนุปริญญา",
};

// Dashboard data is a heavy read (~17 Prisma queries) that changes rarely.
// Cache the computed payload for a short window so a burst of loads costs one
// computation per minute instead of ~17 queries per load. Bust with
// `bustCache("dashboard")` if instant freshness is ever required.
const DASHBOARD_CACHE_TTL_MS = 60_000;

/** Compute (uncached) the full dashboard payload. */
async function getDashboardData() {
  const [
    awardsTotal,
    awardsByYear,
    awardsByType,
    potentialsTotal,
    potentialsByYear,
    associationsTotal,
    distinctAssociations,
    graduateCommitteeTotal,
    graduateCommitteeByTerm,
    modelRepresentativesTotal,
    distinctModelCohorts,
    alumniAgencyTotal,
    distinctAbroadCountries,
    newsTotal,
    newsPublishedCount,
    recentNews,
    accountStatusGroups,
  ] = await Promise.all([
    // Awards total
    prisma.award.count(),

    // Awards by year (for latest year stat)
    prisma.award.groupBy({
      by: ["year"],
      _count: true,
      orderBy: { year: "desc" },
      take: 1,
    }),

    // Awards by type (PRD §3.2 dashboard summary)
    prisma.award.groupBy({
      by: ["awardType"],
      _count: true,
    }),

    // Potentials total
    prisma.potential.count(),

    // Potentials by recorded year
    prisma.potential.groupBy({
      by: ["recordedYear"],
      _count: true,
      orderBy: { recordedYear: "desc" },
      take: 1,
    }),

    // Associations total
    prisma.association.count(),

    // Distinct association names
    prisma.association.findMany({
      select: { associationName: true },
      distinct: ["associationName"],
    }),

    // Graduate committee total
    prisma.graduateCommittee.count(),

    // Graduate committee by term year
    prisma.graduateCommittee.groupBy({
      by: ["termYear"],
      _count: true,
      orderBy: { termYear: "desc" },
      take: 1,
    }),

    // Model representatives total
    prisma.modelRepresentative.count(),

    // Distinct model representative cohorts
    prisma.modelRepresentative.findMany({
      select: { cohort: true },
      distinct: ["cohort"],
    }),

    // Abroad alumni total
    prisma.alumniAgency.count(),

    // Distinct abroad alumni countries
    prisma.alumniAgency.findMany({
      select: { country: true },
      distinct: ["country"],
    }),

    // News total
    prisma.news.count(),

    // News published count
    prisma.news.count({ where: { status: "PUBLISHED" } }),

    // Recent published news (3 items)
    prisma.news.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        coverImageUrl: true,
        publishedAt: true,
        body: true,
      },
    }),

    // Alumni signup accounts grouped by status (PENDING/ACTIVE/REJECTED) — drives
    // the dashboard "pending approvals" card. Same "has an account" base where as
    // GET /api/alumni-accounts so the card's totals match that table.
    prisma.alumni.groupBy({
      by: ["accountStatus"],
      _count: true,
      where: { passwordHash: { not: null }, deletedAt: null },
    }),
  ]);

  // Merge CMU + local Education into PERSONS (union-find by name+birthday,
  // alumniId, and shared studentId) so each person counts once under their
  // highest degree — a locally-added higher degree upgrades them.
  const { byDegree: byDegreeLevel, total: alumniTotal, cmuAvailable } =
    await getPersonDegreeBreakdown();

  // Format degree breakdown string for sub-stat
  const degreeBreakdown = Object.entries(byDegreeLevel)
    .filter(([key]) => key in DEGREE_LABELS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${DEGREE_LABELS[key]} ${count.toLocaleString()}`)
    .join(", ");

  // Alumni signup-account counts by status — same "has an account" definition as
  // the alumni-accounts management table (passwordHash != null, not deleted).
  const accountStatusCounts = Object.fromEntries(
    (accountStatusGroups as { accountStatus: string; _count: number }[]).map(
      (g) => [g.accountStatus, g._count],
    ),
  );

  return {
    // false when the CMU Registrar was unreachable — alumni totals then reflect
    // local rows only. The dashboard renders a warning banner in that case.
    cmuAvailable,
    alumni: {
      total: alumniTotal,
      byDegreeLevel,
      degreeBreakdown,
    },
    alumniAccounts: {
      unverified: accountStatusCounts.UNVERIFIED ?? 0,
      pending: accountStatusCounts.PENDING ?? 0,
      active: accountStatusCounts.ACTIVE ?? 0,
      rejected: accountStatusCounts.REJECTED ?? 0,
    },
    awards: {
      total: awardsTotal,
      latestYear: awardsByYear[0]?.year ?? null,
      latestYearCount: awardsByYear[0]?._count ?? 0,
      byType: Object.fromEntries(
        (awardsByType as { awardType: string; _count: number }[]).map((g) => [g.awardType, g._count])
      ),
    },
    potentials: {
      total: potentialsTotal,
      latestYear: potentialsByYear[0]?.recordedYear ?? null,
      latestYearCount: potentialsByYear[0]?._count ?? 0,
    },
    associations: {
      total: associationsTotal,
      distinctAssociationCount: distinctAssociations.length,
    },
    graduateCommittee: {
      total: graduateCommitteeTotal,
      latestTermYear: graduateCommitteeByTerm[0]?.termYear ?? null,
      latestTermYearCount: graduateCommitteeByTerm[0]?._count ?? 0,
    },
    modelRepresentatives: {
      total: modelRepresentativesTotal,
      distinctCohorts: distinctModelCohorts.length,
    },
    alumniAgency: {
      total: alumniAgencyTotal,
      distinctCountries: distinctAbroadCountries.length,
    },
    news: {
      total: newsTotal,
      publishedCount: newsPublishedCount,
    },
    recentNews,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const payload = await withTtlCache(
      "dashboard",
      DASHBOARD_CACHE_TTL_MS,
      getDashboardData,
    );
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
