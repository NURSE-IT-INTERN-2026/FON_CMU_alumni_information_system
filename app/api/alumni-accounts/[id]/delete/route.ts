import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { checkSuperAdminPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { bustCache } from "@/lib/cache";

// Superadmin-only. Deletes the alumni's *account* (login credentials) while
// KEEPING the alumni data record — studentId/name/education/related rows are
// untouched and `deletedAt` is NOT set (that would hide the record). Nulling
// BOTH `email` and `passwordHash` is what lets the alumni re-sign-up: signup
// dedups on `email` first (409 on any match) and the `email` column is
// `@unique`, so the email must be cleared; on re-signup the `studentId` lookup
// then finds this preserved row with `passwordHash: null` and takes its UPDATE
// branch, re-attaching credentials + re-sending the verification email.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await checkSuperAdminPermission();
    if (denied) return denied;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { id } = await params;

    const alumni = await prisma.alumni.findUnique({ where: { id } });
    if (!alumni) {
      return NextResponse.json({ error: "ไม่พบบัญชี" }, { status: 404 });
    }

    // Nothing to delete if the row never had credentials (pure data record).
    if (!alumni.passwordHash && !alumni.email) {
      return NextResponse.json(
        { error: "บัญชีนี้ไม่มีข้อมูลการเข้าสู่ระบบให้ลบ" },
        { status: 400 }
      );
    }

    // Atomic: wipe the account fields, end active sessions, and invalidate any
    // outstanding verification/reset tokens — all or nothing. accountStatus
    // resets to UNVERIFIED (the "no usable account" baseline; re-signup
    // overwrites it anyway) so the row drops out of every tracked
    // PENDING/ACTIVE/REJECTED count.
    await prisma.$transaction([
      prisma.alumni.update({
        where: { id },
        data: {
          email: null,
          passwordHash: null,
          accountStatus: "UNVERIFIED",
          signupVerification: Prisma.JsonNull,
          emailVerifiedAt: null,
          suspendedAt: null,
          rejectionReason: null,
          rejectedAt: null,
          hasLoggedIn: false,
          lastLoginAt: null,
          tosAcceptedAt: null,
        },
      }),
      prisma.session.deleteMany({ where: { alumniId: id } }),
      prisma.emailVerification.deleteMany({ where: { alumniId: id } }),
      prisma.passwordReset.deleteMany({ where: { alumniId: id } }),
    ]);

    bustCache("dashboard");
    bustCache("alumni-activity");

    await logActivity(
      {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      "DELETE",
      "alumni_auth",
      id,
      {
        alumniName: `${alumni.prefix}${alumni.firstName} ${alumni.lastName}`,
        studentId: alumni.studentId,
        email: alumni.email ?? null,
        source: "admin_delete_account",
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/alumni-accounts/[id]/delete error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดำเนินการ" },
      { status: 500 }
    );
  }
}
