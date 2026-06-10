import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { fetchCmuGraduates } from "@/lib/cmu-registrar";

const DEGREE_LABELS: Record<string, string> = {
  DOCTORAL: "ปริญญาเอก",
  MASTER: "ปริญญาโท",
  BACHELOR: "ปริญญาตรี",
  NURSING_ASSISTANT: "หลักสูตรประกาศนียบัตรผู้ช่วยพยาบาล",
  ASSOCIATE: "อนุปริญญา",
};

// Map CMU Registrar level_id to local degree level keys
const CMU_LEVEL_MAP: Record<string, string> = {
  "0": "ASSOCIATE",
  "1": "BACHELOR",
  "2": "NURSING_ASSISTANT",
  "3": "MASTER",
  "5": "DOCTORAL",
};

/** Resolve the internal degree key, accounting for the special case where
 *  level_id=0 + major_name_th='ประกาศนียบัตรผู้ช่วยพยาบาล' → NURSING_ASSISTANT. */
function resolveDegreeKey(level_id: string, major_name_th: string): string {
  if (level_id === "0" && major_name_th === "ประกาศนียบัตรผู้ช่วยพยาบาล") {
    return "NURSING_ASSISTANT";
  }
  return CMU_LEVEL_MAP[level_id] ?? "OTHER";
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const [
      cmuGraduates,
      awardsTotal,
      awardsByYear,
      potentialsTotal,
      potentialsByYear,
      associationsTotal,
      distinctAssociations,
      graduateCommitteeTotal,
      graduateCommitteeByTerm,
      modelRepresentativesTotal,
      distinctModelCohorts,
      abroadAlumniTotal,
      distinctAbroadCountries,
      newsTotal,
      newsPublishedCount,
      pendingAlumniCount,
      recentNews,
    ] = await Promise.all([
      // Alumni from CMU Registrar API
      fetchCmuGraduates(),

      // Awards total
      prisma.award.count(),

      // Awards by year (for latest year stat)
      prisma.award.groupBy({
        by: ["year"],
        _count: true,
        orderBy: { year: "desc" },
        take: 1,
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
      prisma.abroadAlumni.count(),

      // Distinct abroad alumni countries
      prisma.abroadAlumni.findMany({
        select: { country: true },
        distinct: ["country"],
      }),

      // News total
      prisma.news.count(),

      // News published count
      prisma.news.count({ where: { status: "PUBLISHED" } }),

      // Pending alumni count
      prisma.alumni.count({ where: { approvalStatus: "PENDING" } }),

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
    ]);

    // Build byDegreeLevel map from CMU Registrar data
    const byDegreeLevel: Record<string, number> = {};
    for (const grad of cmuGraduates) {
      const key = resolveDegreeKey(grad.level_id?.trim() ?? "", grad.major_name_th?.trim() ?? "");
      byDegreeLevel[key] = (byDegreeLevel[key] ?? 0) + 1;
    }

    // Format degree breakdown string for sub-stat
    const degreeBreakdown = Object.entries(byDegreeLevel)
      .filter(([key]) => key in DEGREE_LABELS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => `${DEGREE_LABELS[key]} ${count.toLocaleString()}`)
      .join(", ");

    return NextResponse.json({
      alumni: {
        total: cmuGraduates.length,
        byDegreeLevel,
        degreeBreakdown,
      },
      awards: {
        total: awardsTotal,
        latestYear: awardsByYear[0]?.year ?? null,
        latestYearCount: awardsByYear[0]?._count ?? 0,
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
      abroadAlumni: {
        total: abroadAlumniTotal,
        distinctCountries: distinctAbroadCountries.length,
      },
      news: {
        total: newsTotal,
        publishedCount: newsPublishedCount,
      },
      pendingAlumni: pendingAlumniCount,
      recentNews,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
