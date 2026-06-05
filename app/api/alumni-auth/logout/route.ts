import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("fon-cmu-session")?.value;

    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }

    const response = NextResponse.redirect(
      new URL("/alumni/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000")
    );
    response.cookies.set(clearSessionCookie());

    return response;
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการออกจากระบบ" },
      { status: 500 }
    );
  }
}
