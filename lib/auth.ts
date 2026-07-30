import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { Session, AdminUser, Alumni } from "@/app/generated/prisma/client";
import { compare, hash } from "bcryptjs";
import { createHash, randomUUID, timingSafeEqual } from "crypto";

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

/**
 * SHA-256 hex digest of an auth token for AT-REST storage only. The raw token
 * stays in the cookie / email link (which the client already carries); only the
 * DB column stores the hash, so a stolen token table is worthless. No salt or
 * stretching is needed — these are high-entropy random values (randomUUID for
 * sessions, randomBytes(32) for reset/verify). Mirrors the createHash pattern
 * in lib/oauth.ts.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time equality for secrets/tokens (bearer secrets like
 * `Bearer ${CLEANUP_SECRET}`, the OAuth `state` nonce, etc.). JS `===`/`!==`
 * short-circuit on the first differing byte, leaking timing about the secret;
 * `crypto.timingSafeEqual` compares every byte regardless. It THROWS on length
 * mismatch, so guard with a length check first — that leaks only the length
 * (fixed for `Bearer <secret>` and UUID state tokens), never the content.
 * null/undefined is treated as the empty string (length 0 ⇒ always mismatches a
 * non-empty secret, no throw).
 */
export function constantTimeEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const bufA = Buffer.from(a ?? "");
  const bufB = Buffer.from(b ?? "");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.create({
    // Store the token HASH at rest; the raw token is returned below for the cookie.
    data: { userId, token: hashToken(token), expiresAt, sessionType: "ADMIN", alumniId: null },
  });

  return token;
}

export async function createAlumniSession(alumniId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await prisma.session.create({
    // Store the token HASH at rest; the raw token is returned below for the cookie.
    data: { alumniId, token: hashToken(token), expiresAt, sessionType: "ALUMNI", userId: null },
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
    where: { token: hashToken(token) },
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
    where: { token: hashToken(token) },
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
