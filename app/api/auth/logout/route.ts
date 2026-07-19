import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { clearSessionCookie } from "@/lib/auth";
import { BASE_PATH } from "@/lib/constants";
import { getBaseUrl } from "@/lib/base-url";

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

    return NextResponse.redirect(new URL(`${BASE_PATH}/login`, getBaseUrl()));
  } catch {
    return NextResponse.redirect(new URL(`${BASE_PATH}/login`, getBaseUrl()));
  }
}
