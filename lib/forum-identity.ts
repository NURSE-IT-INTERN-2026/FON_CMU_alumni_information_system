import type { Prisma } from "@/app/generated/prisma/client";

/**
 * The SINGLE leak surface for alumni identity in the community forum.
 *
 * Every forum read (topics, replies, reports) selects the author through this
 * fragment, so contact fields (email, contactEmail, phones, homeAddress,
 * citizenId, birthDate) can NEVER be selected — and therefore never leak to
 * other alumni or even to staff via the forum API. Staff who need the full
 * record follow a link to /management/alumni/[id] instead.
 *
 * Client-safe: only a `Prisma.AlumniSelect` type is imported (erased at build).
 * Never import `@/lib/prisma` here — that would pull the DB driver into client
 * bundles. "Standard (with photo)": prefix + name + cohort + degree + photo.
 */
export const SELECT_ALUMNI_PUBLIC_IDENTITY = {
  id: true,
  prefix: true,
  firstName: true,
  lastName: true,
  cohort: true,
  degreeLevel: true,
  photoUrl: true,
} as const satisfies Prisma.AlumniSelect;

export type AlumniPublicIdentity = {
  id: string;
  prefix: string;
  firstName: string;
  lastName: string;
  cohort: string | null;
  degreeLevel: string;
  photoUrl: string | null;
};

/**
 * Display string for an alumni's public identity — "คำนำหน้า ชื่อ นามสกุล".
 * Client-safe (pure).
 */
export function formatAlumniPublicName(a: AlumniPublicIdentity): string {
  return `${a.prefix}${a.firstName} ${a.lastName}`.trim();
}
