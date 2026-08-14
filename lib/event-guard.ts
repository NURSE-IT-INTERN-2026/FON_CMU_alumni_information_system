import { NextResponse } from "next/server";
import { getSession, getAlumniSession } from "@/lib/auth";
import { checkWritePermission } from "@/lib/permissions";
import type { Alumni } from "@/app/generated/prisma/client";
import { alumniLogCtx } from "@/lib/forum-guard";

/**
 * Server-only gates for alumni community EVENTS. Unlike the forum (opt-in),
 * events are a BROADCAST: every ACTIVE alum can see them and RSVP. Only
 * CREATION requires consent (an opted-in alum) or a staff member. Never import
 * this across a `"use client"` boundary (imports auth + permissions).
 */

type AdminSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export function eventUnauthorized() {
  return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
}

/**
 * A reader = staff (any role) OR any alumni session (`getAlumniSession` already
 * enforces ACTIVE + non-suspended). NO opt-in gate — events are a broadcast.
 */
export async function resolveEventReader(): Promise<
  { staff?: AdminSession; alumni?: Alumni } | { error: NextResponse }
> {
  const [staff, alumniSession] = await Promise.all([
    getSession(),
    getAlumniSession(),
  ]);
  if (staff) return { staff };
  if (alumniSession?.alumni) return { alumni: alumniSession.alumni };
  return { error: eventUnauthorized() };
}

/**
 * A creator = a staff member with write permission (exec blocked) OR an opted-in
 * alumni. Returns who created (so the route sets the right organizer FK + actor).
 */
export async function resolveEventCreator(): Promise<
  { staff: AdminSession } | { alumni: Alumni } | { error: NextResponse }
> {
  const [staff, alumniSession] = await Promise.all([
    getSession(),
    getAlumniSession(),
  ]);
  if (staff) {
    const permErr = await checkWritePermission();
    if (permErr) return { error: permErr };
    return { staff };
  }
  if (alumniSession?.alumni) {
    if (!alumniSession.alumni.communityOptedInAt) {
      return {
        error: NextResponse.json(
          { error: "ต้องเข้าร่วมชุมชนศิษย์เก่าก่อนจึงจะจัดกิจกรรมได้", code: "NOT_OPTED_IN" },
          { status: 403 },
        ),
      };
    }
    return { alumni: alumniSession.alumni };
  }
  return { error: eventUnauthorized() };
}

/** "staff or (any) alumni" — for DELETE; the route then checks organizer ownership. */
export async function resolveEventStaffOrAlumni(): Promise<
  { staff?: AdminSession; alumni?: Alumni } | { error: NextResponse }
> {
  const [staff, alumniSession] = await Promise.all([
    getSession(),
    getAlumniSession(),
  ]);
  if (staff) return { staff };
  if (alumniSession?.alumni) return { alumni: alumniSession.alumni };
  return { error: eventUnauthorized() };
}

/** Admin actor context for logActivity (mirrors alumniLogCtx shape). */
export function adminLogCtx(s: AdminSession) {
  return {
    actorType: "ADMIN" as const,
    userId: s.user.id,
    userEmail: s.user.email,
    userRole: s.user.role,
  };
}

export { alumniLogCtx };
