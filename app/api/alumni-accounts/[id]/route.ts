import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { checkWritePermission, checkNonExecutivePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { TRACKED_FIELDS, computeFieldChanges, recordFieldChanges } from "@/lib/field-changes";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Account management is excluded from the read-only executive role
    // (PRD §2.1/§4.1) — same guard the users/logs GETs use.
    const denied = await checkNonExecutivePermission();
    if (denied) return denied;
    const { id } = await params;
    const alumni = await prisma.alumni.findUnique({ where: { id } });

    if (!alumni) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลศิษย์เก่า" },
        { status: 404 }
      );
    }

    return NextResponse.json(alumni);
  } catch (error) {
    console.error("GET /api/alumni-accounts/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Write sub-routes require admin/superadmin (PRD §4.1) — the read-only
    // executive role must not change an alumni's login email (account takeover)
    // or any account field. Mirrors approve/reject/reverify.
    const denied = await checkWritePermission();
    if (denied) return denied;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();

    // Edit reason is optional (the UI no longer requires it). Pass whatever
    // value through to the audit logs.
    const reason = typeof body?.reason === "string" ? body.reason : undefined;

    // Admin can edit all alumni fields
    // Admin can edit these alumni fields. (Removed columns that no longer
    // exist on Alumni — `newLastName`/`currentWorkplace`/`country`/`province`
    // — which would 500 if sent.)
    const allowedFields = [
      "prefix", "firstName", "lastName",
      "cohort", "degreeLevel", "email", "contactEmail", "phones",
      "citizenId", "birthDate",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "ไม่มีข้อมูลที่จะอัปเดต" },
        { status: 400 }
      );
    }

    // Set adminEditedAt timestamp to trigger alumni notification
    updateData.adminEditedAt = new Date();

    const old = await prisma.alumni.findUnique({ where: { id } });

    const alumni = await prisma.alumni.update({
      where: { id },
      data: updateData,
    });

    // Log admin edit of alumni profile + field-change history
    const changes = computeFieldChanges(old, alumni, TRACKED_FIELDS.alumni_profile);
    const logId = await logActivity(
      {
        actorType: "ADMIN",
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: session.user.role,
      },
      "UPDATE",
      "alumni_profile",
      alumni.id,
      { changes, source: "admin_edit" },
      reason
    );
    await recordFieldChanges({ resourceType: "alumni_profile", resourceId: alumni.id, changes, actor: { actorType: "ADMIN", userId: session.user.id, actorName: session.user.email }, reason, activityLogId: logId });

    return NextResponse.json(alumni);
  } catch (error) {
    console.error("PUT /api/alumni-accounts/[id] error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
      { status: 500 }
    );
  }
}
