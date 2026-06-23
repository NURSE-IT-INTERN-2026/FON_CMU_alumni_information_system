import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchCmuGraduates } from "@/lib/cmu-registrar";

// POST /api/cmu-alumni/sync
// Detect CMU FON graduates not yet present locally (virtual — does NOT create
// local rows). When such a person later signs up / is imported, the education
// on-create hook generates their graduation logs. Secured by CMU_SYNC_SECRET:
//   curl -X POST https://<host>/api/cmu-alumni/sync \
//        -H "Authorization: Bearer <CMU_SYNC_SECRET>"
export async function POST(request: Request) {
  const secret = process.env.CMU_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CMU_SYNC_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cmu = await fetchCmuGraduates();
    const local = await prisma.alumni.findMany({
      where: { deletedAt: null },
      select: { studentId: true },
    });
    const localSet = new Set(local.map((a) => a.studentId));
    const newGrads = cmu.filter(
      (g) => !localSet.has(String(g.student_id ?? "").trim()),
    );

    return NextResponse.json({
      cmuTotal: cmu.length,
      localTotal: local.length,
      newCount: newGrads.length,
      sample: newGrads.slice(0, 50).map((g) => ({
        studentId: String(g.student_id ?? "").trim(),
        name: `${g.name_th ?? ""} ${g.surname_th ?? ""}`.trim(),
        level_id: g.level_id,
        grad_year: g.grad_year,
      })),
    });
  } catch (error) {
    console.error("POST /api/cmu-alumni/sync error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการตรวจสอบทะเบียน" }, { status: 500 });
  }
}
