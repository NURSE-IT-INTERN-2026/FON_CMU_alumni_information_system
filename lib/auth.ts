import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { Session, AdminUser, Alumni } from "@/app/generated/prisma/client";
import { compare, hash } from "bcryptjs";
import { randomUUID } from "crypto";

// Explicit types for narrowed session returns
type AdminSession = Session & { user: AdminUser };
type AlumniSession = Session & { alumni: Alumni };

const SESSION_COOKIE = "fon-cmu-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.create({
    data: { userId, token, expiresAt, sessionType: "ADMIN", alumniId: null },
  });

  return token;
}

export async function createAlumniSession(alumniId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.create({
    data: { alumniId, token, expiresAt, sessionType: "ALUMNI", userId: null },
  });

  return token;
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  // Probabilistic cleanup: prune expired sessions ~1% of requests (fire-and-forget)
  if (Math.random() < 0.01) {
    cleanupExpiredSessions().catch(() => {});
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  // Only return admin sessions from getSession()
  if (session.sessionType !== "ADMIN") {
    return null;
  }

  if (!session.user || !session.user.isActive) {
    return null;
  }

  return session as AdminSession;
}

export async function getAlumniSession(): Promise<AlumniSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { alumni: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  // Only return alumni sessions
  if (session.sessionType !== "ALUMNI") {
    return null;
  }

  if (!session.alumni) {
    return null;
  }

  // A tombstoned record must never yield a valid session, even if a session
  // row still exists (e.g. a concurrent request during self-soft-delete).
  if (session.alumni.deletedAt) {
    return null;
  }

  // A suspended account is fully blocked (PRD §3.15): no valid session, so the
  // (authed) layout redirects to /login and API calls 401.
  if (session.alumni.suspendedAt) {
    return null;
  }

  // Admin-approval signup flow: only ACTIVE accounts have a valid session.
  // PENDING/REJECTED accounts never receive a session, but guard here too so a
  // stale session row (e.g. created just before an account was suspended/
  // rejected) can't grant access.
  if (session.alumni.accountStatus !== "ACTIVE") {
    return null;
  }

  return session as AlumniSession;
}

export function setSessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_MAX_AGE,
    path: "/",
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };
}
