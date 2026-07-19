import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { clearSessionCookie } from "@/lib/auth";
import { BASE_PATH } from "@/lib/constants";
import { getBaseUrl } from "@/lib/base-url";

async function performLogout() {
  const cookieStore = await cookies();
  const token = cookieStore.get("fon-cmu-session")?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  const response = NextResponse.redirect(
    new URL(`${BASE_PATH}/login`, getBaseUrl())
  );
  response.cookies.set(clearSessionCookie());

  return response;
}

export async function GET() {
  try {
    return await performLogout();
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการออกจากระบบ" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    return await performLogout();
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการออกจากระบบ" },
      { status: 500 }
    );
  }
}
