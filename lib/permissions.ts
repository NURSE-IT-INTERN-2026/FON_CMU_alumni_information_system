import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function checkWritePermission(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบ" },
      { status: 401 }
    );
  }
  if (session.user.role === "executive") {
    return NextResponse.json(
      { error: "คุณไม่มีสิทธิ์ดำเนินการนี้" },
      { status: 403 }
    );
  }
  return null;
}
