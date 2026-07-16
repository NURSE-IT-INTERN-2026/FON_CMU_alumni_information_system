import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCmuGraduatesLocal } from "@/lib/cmu-registrar";
import { dedupeCmuGraduatesByPerson } from "@/lib/alumni-verify";
import { getLocalAlumniStudentIdSet, classifyCmuByLink } from "@/lib/cmu-alumni-link";

/**
 * Linked / unlinked counts for the cmu-sync page's two tab badges. Reads the
 * LOCAL `cmu_graduates` cache (no live Registrar call — works even while the
 * Registrar is down, as long as a sync has run) and splits the DEDUPED set
 * against the local alumni studentId-set, so the counts equal the tables'
 * totals (the tables also dedupe by default). Session-gated like the list route.
 *
 * GET /api/cmu-alumni/link-counts → { linked, unlinked }
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const [raw, localSidSet] = await Promise.all([
      getCmuGraduatesLocal(),
      getLocalAlumniStudentIdSet(),
    ]);
    const { linked, unlinked } = classifyCmuByLink(
      dedupeCmuGraduatesByPerson(raw),
      localSidSet,
    );
    return NextResponse.json({ linked: linked.length, unlinked: unlinked.length });
  } catch (error) {
    console.error("GET /api/cmu-alumni/link-counts error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนับข้อมูลศิษย์เก่า" },
      { status: 500 },
    );
  }
}
