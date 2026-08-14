import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { checkWritePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { resolveEventReader, resolveEventStaffOrAlumni, adminLogCtx, alumniLogCtx } from "@/lib/event-guard";
import { SELECT_ALUMNI_PUBLIC_IDENTITY } from "@/lib/forum-identity";
import { bangkokDatetimeLocalToIso } from "@/lib/event-format";
import { handleZodError, jobUpdateSchema } from "@/lib/validations";

/**
 * One job posting. GET = broadcast read. PUT/DELETE = author (alumni) or
 * staff (exec read-only via checkWritePermission). DELETE is a soft-delete
 * (`job-posting` in TRASH_ENTITIES).
 */

const AUTHOR_INCLUDE = {
  authorAlumni: { select: SELECT_ALUMNI_PUBLIC_IDENTITY },
  authorUser: { select: { id: true, firstName: true, lastName: true } },
} as const;

function shapeAuthor(j: {
  authorAlumni?: { id: string; prefix: string; firstName: string; lastName: string; cohort: string | null; degreeLevel: string; photoUrl: string | null } | null;
  authorUser?: { id: string; firstName: string; lastName: string } | null;
}) {
  if (j.authorAlumni) return { type: "alumni" as const, ...j.authorAlumni };
  if (j.authorUser) return { type: "staff" as const, id: j.authorUser.id, name: `${j.authorUser.firstName} ${j.authorUser.lastName}`.trim() };
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reader = await resolveEventReader();
    if ("error" in reader) return reader.error;

    const { id } = await params;
    const job = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null },
      include: AUTHOR_INCLUDE,
    });
    if (!job) return NextResponse.json({ error: "ไม่พบประกาศงาน" }, { status: 404 });

    return NextResponse.json({ ...job, author: shapeAuthor(job), expired: job.expiresAt < new Date() });
  } catch (error) {
    console.error("GET /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const who = await resolveEventStaffOrAlumni();
    if ("error" in who) return who.error;
    const { id } = await params;

    const existing = await prisma.jobPosting.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ไม่พบประกาศงาน" }, { status: 404 });

    if (who.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else if (existing.authorAlumniId !== who.alumni!.id) {
      return NextResponse.json({ error: "คุณไม่สามารถแก้ไขประกาศงานของผู้อื่นได้" }, { status: 403 });
    }

    const v = jobUpdateSchema.parse(await request.json());
    const job = await prisma.jobPosting.update({
      where: { id },
      data: {
        ...(v.title !== undefined ? { title: v.title } : {}),
        ...(v.workplace !== undefined ? { workplace: v.workplace } : {}),
        position: v.position?.trim() || null,
        province: v.province?.trim() || null,
        country: v.country?.trim() || null,
        ...(v.description !== undefined ? { description: v.description } : {}),
        applyUrl: v.applyUrl?.trim() || null,
        contactInfo: v.contactInfo?.trim() || null,
        ...(v.expiresAt !== undefined
          ? { expiresAt: new Date(bangkokDatetimeLocalToIso(v.expiresAt)) }
          : {}),
      },
      include: AUTHOR_INCLUDE,
    });

    const actor = who.staff ? adminLogCtx(who.staff) : alumniLogCtx(who.alumni!);
    await logActivity(actor, "UPDATE", "job_posting", id, { title: job.title });

    return NextResponse.json({ ...job, author: shapeAuthor(job) });
  } catch (error) {
    if (error instanceof z.ZodError) return handleZodError(error);
    console.error("PUT /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึก" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const who = await resolveEventStaffOrAlumni();
    if ("error" in who) return who.error;
    const { id } = await params;

    const existing = await prisma.jobPosting.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ไม่พบประกาศงาน" }, { status: 404 });

    if (who.staff) {
      const permErr = await checkWritePermission();
      if (permErr) return permErr;
    } else if (existing.authorAlumniId !== who.alumni!.id) {
      return NextResponse.json({ error: "คุณไม่สามารถลบประกาศงานของผู้อื่นได้" }, { status: 403 });
    }

    await prisma.jobPosting.update({ where: { id }, data: { deletedAt: new Date() } });

    const actor = who.staff ? adminLogCtx(who.staff) : alumniLogCtx(who.alumni!);
    await logActivity(actor, "DELETE", "job_posting", id, {
      title: existing.title,
      ...(who.staff ? { moderation: true } : {}),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบ" }, { status: 500 });
  }
}
