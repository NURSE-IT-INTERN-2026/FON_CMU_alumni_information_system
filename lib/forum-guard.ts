import { NextResponse } from "next/server";
import { getSession, getAlumniSession } from "@/lib/auth";
import type { Alumni } from "@/app/generated/prisma/client";

/**
 * Server-only opt-in gate for the alumni community forum. Composes the existing
 * auth helpers — no new permission primitive. Never import this across a
 * `"use client"` boundary (it imports auth, which reads cookies + Prisma).
 *
 * Membership rule: an alumni must have `communityOptedInAt` set to read or post.
 * Staff (any role) are exempt — they moderate, not participate. Anonymous → 401.
 * A non-opted-in alumni → 403 `{ code: "NOT_OPTED_IN" }` (the alumni UI shows
 * the join card on this). Contact-field safety is enforced separately by the
 * `SELECT_ALUMNI_PUBLIC_IDENTITY` fragment in lib/forum-identity.ts.
 */

type AdminSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export function forumUnauthorized() {
  return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
}

export function forumNotOptedIn() {
  return NextResponse.json(
    {
      error: "ยังไม่ได้เข้าร่วมชุมชนศิษย์เก่า กรุณาเข้าร่วมก่อนใช้งานกระดานสนทนา",
      code: "NOT_OPTED_IN",
    },
    { status: 403 },
  );
}

/**
 * A forum reader = staff (any role) OR an opted-in alumni. Use on GET handlers.
 * Staff win when both sessions somehow resolve (they don't share a cookie, but
 * be deterministic). Returns the resolved identity for caller convenience.
 */
export async function resolveForumReader(): Promise<
  { staff?: AdminSession; alumni?: Alumni } | { error: NextResponse }
> {
  const [staff, alumniSession] = await Promise.all([
    getSession(),
    getAlumniSession(),
  ]);
  if (staff) return { staff };
  if (!alumniSession || !alumniSession.alumni) return { error: forumUnauthorized() };
  if (!alumniSession.alumni.communityOptedInAt) return { error: forumNotOptedIn() };
  return { alumni: alumniSession.alumni };
}

/**
 * A forum writer = an opted-in alumni only. Staff never post as alumni (they
 * have a different sessionType). Use on POST/PUT for alumni-authored content.
 */
export async function requireForumAlumni(): Promise<
  { alumni: Alumni } | { error: NextResponse }
> {
  const session = await getAlumniSession();
  if (!session || !session.alumni) return { error: forumUnauthorized() };
  if (!session.alumni.communityOptedInAt) return { error: forumNotOptedIn() };
  return { alumni: session.alumni };
}

/** "staff or owner" — used by DELETE so an alumni can remove their own past
 *  content even after opting out, and so staff can moderate any content. */
export async function resolveForumStaffOrOwner(): Promise<
  { staff?: AdminSession; alumni?: Alumni } | { error: NextResponse }
> {
  const [staff, alumniSession] = await Promise.all([
    getSession(),
    getAlumniSession(),
  ]);
  if (staff) return { staff };
  if (alumniSession?.alumni) return { alumni: alumniSession.alumni };
  return { error: forumUnauthorized() };
}

/** Build the ALUMNI actor context for logActivity. */
export function alumniLogCtx(a: Alumni) {
  return {
    actorType: "ALUMNI" as const,
    alumniId: a.id,
    alumniName: `${a.prefix}${a.firstName} ${a.lastName}`,
  };
}
