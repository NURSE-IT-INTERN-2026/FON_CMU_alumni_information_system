import { NextResponse } from "next/server";
import { getSession, getAlumniSession } from "@/lib/auth";

export async function checkWritePermission(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบ" },
      { status: 401 }
    );
  }
  // The "executive" role is read-only across the entire admin area — it may
  // view every page but never create/edit/delete. Every mutating route funnels
  // through this helper, so blocking it here makes the role read-only everywhere.
  if (session.user.role === "executive") {
    return NextResponse.json(
      { error: "บัญชีผู้บริหารสามารถดูข้อมูลได้เท่านั้น ไม่สามารถแก้ไขหรือบันทึกข้อมูลได้" },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Blocks the read-only "executive" role from a READ endpoint that serves a
 * page executives are excluded from (logs, user management). Mirrors
 * checkSuperAdminPermission. Use on GET handlers whose data executives must
 * never see; writes are already covered by checkWritePermission.
 */
export async function checkNonExecutivePermission(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบ" },
      { status: 401 }
    );
  }
  if (session.user.role === "executive") {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้" },
      { status: 403 }
    );
  }
  return null;
}

export async function checkSuperAdminPermission(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบ" },
      { status: 401 }
    );
  }
  if (session.user.role !== "superadmin") {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์ดำเนินการนี้ ต้องเป็นผู้ดูแลระบบขั้นสูงเท่านั้น" },
      { status: 403 }
    );
  }
  return null;
}

export async function checkAlumniSession(): Promise<{ alumni: { id: string; studentId: string; prefix: string; firstName: string; lastName: string } } | { error: NextResponse }> {
  const session = await getAlumniSession();
  if (!session || !session.alumni) {
    return { error: NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  }
  return { alumni: session.alumni };
}
