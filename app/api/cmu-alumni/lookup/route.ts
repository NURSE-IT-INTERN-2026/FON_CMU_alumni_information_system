import { NextRequest, NextResponse } from "next/server";
import { getSession, getAlumniSession } from "@/lib/auth";
import { fetchCmuGraduateById } from "@/lib/cmu-registrar";
import { cmuToAlumniFields } from "@/lib/ensure-alumni";

// GET /api/cmu-alumni/lookup?studentId=… — look up one CMU Registrar record by
// studentId and return the education-relevant fields, for the add-education
// form's auto-fill preview. Admin or logged-in alumni only.
export async function GET(request: NextRequest) {
  const admin = await getSession();
  const alumni = await getAlumniSession();
  if (!admin && !alumni?.alumni) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const studentId = request.nextUrl.searchParams.get("studentId")?.trim();
  if (!studentId) {
    return NextResponse.json({ error: "กรุณาระบุรหัสนักศึกษา" }, { status: 400 });
  }

  try {
    const grad = await fetchCmuGraduateById(studentId);
    if (!grad) {
      return NextResponse.json({ error: "ไม่พบข้อมูลในระบบทะเบียน" }, { status: 404 });
    }
    const f = cmuToAlumniFields(grad);
    return NextResponse.json({
      studentId: String(grad.student_id ?? "").trim(),
      degreeLevel: f.degreeLevel,
      graduationYear: f.graduationYear,
      major: f.major,
      cohort: f.cohort,
      firstName: f.firstName,
      lastName: f.lastName,
    });
  } catch (error) {
    console.error("GET /api/cmu-alumni/lookup error:", error);
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "ระบบทะเบียนมหาวิทยาลัยไม่ตอบสนอง กรุณาลองใหม่ภายหลัง" },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบทะเบียน" },
      { status: 500 },
    );
  }
}
