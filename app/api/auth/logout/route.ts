import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { clearSessionCookie } from "@/lib/auth";
import { BASE_PATH } from "@/lib/constants";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("fon-cmu-session")?.value;

    if (token) {
      await prisma.session.deleteMany({
        where: { token },
      });
    }

    cookieStore.set(clearSessionCookie());

    return NextResponse.redirect(new URL(`${BASE_PATH}/login`, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
  } catch {
    return NextResponse.redirect(new URL(`${BASE_PATH}/login`, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
  }
}
