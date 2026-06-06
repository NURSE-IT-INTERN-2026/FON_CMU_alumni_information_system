import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { createAlumniSession, setSessionCookie } from "@/lib/auth";
import { getPendingEmailCookieName } from "@/lib/oauth";
import { logActivity, getIp } from "@/lib/activity-log";

export async function POST(request: Request) {
  try {
    // Read the pending CMU email from cookie
    const cookieStore = await cookies();
    const pendingEmail = cookieStore.get(getPendingEmailCookieName())?.value;

    if (!pendingEmail) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูล OAuth กรุณาเข้าสู่ระบบด้วย CMU IT Account อีกครั้ง" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { studentId, cohort, firstName, maidenLastName, birthDate } = body;

    // Validate all fields present
    if (!studentId || !cohort || !firstName || !maidenLastName || !birthDate) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    // Validate birthDate format: DDMMYYYY
    if (!/^\d{8}$/.test(birthDate)) {
      return NextResponse.json(
        { error: "รูปแบบวันเกิดไม่ถูกต้อง ต้องเป็น DDMMYYYY" },
        { status: 400 }
      );
    }

    // Match against alumni records
    const alumni = await prisma.alumni.findFirst({
      where: {
        studentId,
        cohort,
        firstName: { equals: firstName.trim(), mode: "insensitive" },
        maidenLastName: { equals: maidenLastName.trim(), mode: "insensitive" },
        birthDate,
      },
    });

    if (!alumni) {
      // No exact match — don't reject, let admin verify instead
      const existingByStudentId = await prisma.alumni.findUnique({
        where: { studentId },
      });

      let targetAlumni;
      let matchType: string;

      if (existingByStudentId) {
        // Student ID exists but other details don't match — link for admin verification
        if (existingByStudentId.cmuEmail && existingByStudentId.cmuEmail !== pendingEmail) {
          return NextResponse.json(
            { error: "รหัสนักศึกษานี้เชื่อมโยงกับบัญชี CMU อื่นแล้ว กรุณาติดต่อผู้ดูแลระบบ" },
            { status: 409 }
          );
        }

        await prisma.alumni.update({
          where: { id: existingByStudentId.id },
          data: {
            cmuEmail: pendingEmail,
            approvalStatus: "PENDING",
            hasLoggedIn: true,
            lastLoginAt: new Date(),
            ...(existingByStudentId.email ? {} : { email: pendingEmail }),
          },
        });

        targetAlumni = existingByStudentId;
        matchType = "studentId_only";
      } else {
        // No record at all — create new alumni for admin to verify
        targetAlumni = await prisma.alumni.create({
          data: {
            studentId,
            firstName: firstName.trim(),
            maidenLastName: maidenLastName.trim(),
            cohort,
            birthDate,
            prefix: "-",
            degreeLevel: "BACHELOR",
            cmuEmail: pendingEmail,
            email: pendingEmail,
            approvalStatus: "PENDING",
            hasLoggedIn: true,
            lastLoginAt: new Date(),
          },
        });
        matchType = "new_record";
      }

      // Create alumni session
      const token = await createAlumniSession(targetAlumni.id);
      cookieStore.set(setSessionCookie(token));

      // Clear the pending email cookie
      cookieStore.set({
        name: getPendingEmailCookieName(),
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });

      // Log activity
      await logActivity(
        {
          actorType: "ALUMNI",
          alumniId: targetAlumni.id,
          alumniName: `${targetAlumni.firstName} ${targetAlumni.maidenLastName}`,
        },
        "VERIFY_IDENTITY",
        "alumni_auth",
        targetAlumni.id,
        {
          cmuEmail: pendingEmail,
          method: "oauth",
          matchType,
          submittedData: { studentId, cohort, firstName: firstName.trim(), maidenLastName: maidenLastName.trim(), birthDate },
        },
        getIp(request)
      );

      return NextResponse.json({
        success: true,
        redirect: "/alumni/pending",
      });
    }

    // Check if alumni already linked to a different CMU email
    if (alumni.cmuEmail && alumni.cmuEmail !== pendingEmail) {
      return NextResponse.json(
        { error: "ข้อมูลนี้เชื่อมโยงกับบัญชี CMU อื่นแล้ว กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 409 }
      );
    }

    // If already linked to this CMU email and APPROVED, log them in directly
    if (alumni.cmuEmail === pendingEmail && alumni.approvalStatus === "APPROVED") {
      const token = await createAlumniSession(alumni.id);
      cookieStore.set(setSessionCookie(token));

      await prisma.alumni.update({
        where: { id: alumni.id },
        data: {
          hasLoggedIn: true,
          lastLoginAt: new Date(),
        },
      });

      // Clear the pending email cookie
      cookieStore.set({
        name: getPendingEmailCookieName(),
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });

      return NextResponse.json({
        success: true,
        redirect: "/alumni/profile",
      });
    }

    // If REJECTED, block access
    if (alumni.approvalStatus === "REJECTED") {
      return NextResponse.json(
        { error: "บัญชีของท่านถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 403 }
      );
    }

    // Update alumni: set cmuEmail, set PENDING status
    await prisma.alumni.update({
      where: { id: alumni.id },
      data: {
        cmuEmail: pendingEmail,
        approvalStatus: "PENDING",
        hasLoggedIn: true,
        lastLoginAt: new Date(),
        // Also set email if it's currently null
        ...(alumni.email ? {} : { email: pendingEmail }),
      },
    });

    // Create alumni session
    const token = await createAlumniSession(alumni.id);
    cookieStore.set(setSessionCookie(token));

    // Clear the pending email cookie
    cookieStore.set({
      name: getPendingEmailCookieName(),
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    // Log activity
    await logActivity(
      {
        actorType: "ALUMNI",
        alumniId: alumni.id,
        alumniName: `${alumni.firstName} ${alumni.maidenLastName}`,
      },
      "VERIFY_IDENTITY",
      "alumni_auth",
      alumni.id,
      { cmuEmail: pendingEmail, method: "oauth" },
      getIp(request)
    );

    return NextResponse.json({
      success: true,
      redirect: "/alumni/pending",
    });
  } catch {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
